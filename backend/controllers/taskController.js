const pool = require('../db');

// allowed task types - kept in sync with the dropdown on the Tasks page.
// validated on both create and update so a malicious or buggy client
// can't insert arbitrary strings.
const ALLOWED_TASK_TYPES = ['Studying', 'Reading', 'Writing', 'Programming', 'Planning', 'Reviewing'];

function normaliseDependencyIds(body) {
  const raw = Array.isArray(body.dependency_task_ids)
    ? body.dependency_task_ids
    : (body.dependency_task_id ? [body.dependency_task_id] : []);
  return Array.from(new Set(raw.map(n => Number(n)).filter(Number.isFinite)));
}

// helper: returns a normalised ISO date string if `value` is a valid date,
// or null if the value is missing/empty, or undefined to signal an error
function parseDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

async function dependencyChainContains(startTaskId, targetTaskId) {
  let frontier = [Number(startTaskId)];
  const seen = new Set();

  for (let depth = 0; depth < 50 && frontier.length > 0; depth++) {
    if (frontier.includes(targetTaskId)) return true;
    frontier = frontier.filter(id => !seen.has(id));
    frontier.forEach(id => seen.add(id));
    if (frontier.length === 0) return false;

    const result = await pool.query(
      'SELECT dependency_task_id FROM task_dependencies WHERE task_id = ANY($1::int[])',
      [frontier]
    );
    frontier = result.rows.map(row => Number(row.dependency_task_id)).filter(Number.isFinite);
  }

  return false;
}

async function validateDependencies(ids, moduleId, taskId) {
  if (ids.length === 0) return null;
  if (taskId && ids.includes(Number(taskId))) {
    return { status: 400, message: 'task cannot depend on itself' };
  }

  const dependencyResult = await pool.query(
    'SELECT id FROM tasks WHERE id = ANY($1::int[]) AND module_id = $2',
    [ids, moduleId]
  );
  if (dependencyResult.rows.length !== ids.length) {
    return { status: 404, message: 'one or more dependency tasks were not found in this module' };
  }

  if (taskId) {
    for (const dependencyId of ids) {
      // Walk the chain: starting from each proposed dependency, follow its
      // own dependencies. If we ever land back on the task being updated,
      // it's a cycle - reject. Cap at 50 hops just in case.
      if (await dependencyChainContains(dependencyId, Number(taskId))) {
        return { status: 400, message: 'this dependency would create a circular chain' };
      }
    }
  }

  return null;
}

async function replaceDependencies(client, taskId, dependencyIds) {
  await client.query('DELETE FROM task_dependencies WHERE task_id = $1', [taskId]);
  for (const dependencyId of dependencyIds) {
    await client.query(
      'INSERT INTO task_dependencies (task_id, dependency_task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [taskId, dependencyId]
    );
  }
}

// get all tasks for a specific module
const getTasksByModule = async (req, res) => {
  try {
    const { module_id } = req.query;
    const userId = req.user.id;

    // validate that module_id query parameter is present
    if (!module_id) {
      return res.status(400).json({ message: 'module_id query parameter is required' });
    }

    // verify module exists and belongs to current user
    const moduleCheck = await pool.query(
      'SELECT id FROM modules WHERE id = $1 AND user_id = $2',
      [module_id, userId]
    );
    if (moduleCheck.rows.length === 0) {
      return res.status(404).json({ message: 'module not found or unauthorized' });
    }

    // query tasks table for all tasks with matching module_id
    const result = await pool.query(
      `SELECT t.*,
              COALESCE(
                ARRAY_AGG(td.dependency_task_id) FILTER (WHERE td.dependency_task_id IS NOT NULL),
                CASE WHEN t.dependency_task_id IS NOT NULL
                  THEN ARRAY[t.dependency_task_id]
                  ELSE ARRAY[]::int[]
                END
              ) AS dependency_task_ids
         FROM tasks t
         LEFT JOIN task_dependencies td ON td.task_id = t.id
        WHERE t.module_id = $1
        GROUP BY t.id
        ORDER BY t.id`,
      [module_id]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('get tasks by module error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// create a new task
const createTask = async (req, res) => {
  try {
    const { module_id, title, type, required_hours, start_date, end_date, notes } = req.body;
    const userId = req.user.id;
    const dependencyIds = normaliseDependencyIds(req.body);

    // validate required fields are present
    if (!module_id || !title || !type || required_hours === undefined) {
      return res.status(400).json({ message: 'module_id title type and required_hours are required' });
    }

    // validate type against the allowed set
    if (!ALLOWED_TASK_TYPES.includes(type)) {
      return res.status(400).json({ message: 'type must be one of: ' + ALLOWED_TASK_TYPES.join(', ') });
    }

    // validate required_hours is a positive number
    if (isNaN(required_hours) || required_hours <= 0) {
      return res.status(400).json({ message: 'required_hours must be a positive number' });
    }

    // validate start_date / end_date if provided, and that start <= end
    const startISO = parseDate(start_date);
    const endISO = parseDate(end_date);
    if (startISO === undefined) return res.status(400).json({ message: 'start_date is not a valid date' });
    if (endISO === undefined) return res.status(400).json({ message: 'end_date is not a valid date' });
    if (startISO && endISO && startISO > endISO) {
      return res.status(400).json({ message: 'start_date must be on or before end_date' });
    }

    // verify module exists and belongs to current user
    const moduleCheck = await pool.query(
      'SELECT id FROM modules WHERE id = $1 AND user_id = $2',
      [module_id, userId]
    );
    if (moduleCheck.rows.length === 0) {
      return res.status(404).json({ message: 'module not found' });
    }

    // if dependency ids are provided validate they exist in the same module
    const dependencyError = await validateDependencies(dependencyIds, module_id);
    if (dependencyError) {
      return res.status(dependencyError.status).json({ message: dependencyError.message });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // insert new task into tasks table
      const result = await client.query(
        'INSERT INTO tasks (module_id, title, type, required_hours, start_date, end_date, dependency_task_id, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [module_id, title, type, required_hours, startISO, endISO, dependencyIds[0] || null, notes || null]
      );
      await replaceDependencies(client, result.rows[0].id, dependencyIds);
      await client.query('COMMIT');
      result.rows[0].dependency_task_ids = dependencyIds;
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('create task error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// update an existing task
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, required_hours, start_date, end_date, dependency_task_id, dependency_task_ids, notes } = req.body;
    const userId = req.user.id;
    const dependencyIdsProvided = dependency_task_ids !== undefined || dependency_task_id !== undefined;
    const dependencyIds = dependencyIdsProvided ? normaliseDependencyIds(req.body) : null;

    // validate type against the allowed set if provided
    if (type !== undefined && !ALLOWED_TASK_TYPES.includes(type)) {
      return res.status(400).json({ message: 'type must be one of: ' + ALLOWED_TASK_TYPES.join(', ') });
    }

    // validate required_hours is a positive number if provided
    if (required_hours !== undefined && (isNaN(required_hours) || required_hours <= 0)) {
      return res.status(400).json({ message: 'required_hours must be a positive number' });
    }

    // get current task and verify ownership by joining with modules
    const currentResult = await pool.query(
      'SELECT t.* FROM tasks t JOIN modules m ON t.module_id = m.id WHERE t.id = $1 AND m.user_id = $2',
      [id, userId]
    );
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ message: 'task not found' });
    }
    const current = currentResult.rows[0];

    // validate start_date / end_date if provided
    let startISO;
    if (start_date !== undefined) {
      startISO = parseDate(start_date);
      if (startISO === undefined) return res.status(400).json({ message: 'start_date is not a valid date' });
    }
    let endISO;
    if (end_date !== undefined) {
      endISO = parseDate(end_date);
      if (endISO === undefined) return res.status(400).json({ message: 'end_date is not a valid date' });
    }
    const finalStart = start_date !== undefined ? startISO : current.start_date;
    const finalEnd = end_date !== undefined ? endISO : current.end_date;
    if (finalStart && finalEnd && new Date(finalStart) > new Date(finalEnd)) {
      return res.status(400).json({ message: 'start_date must be on or before end_date' });
    }

    // if new dependencies are provided, validate them: must not be self,
    // must exist, must belong to the same module, AND must not introduce
    // a transitive cycle.
    if (dependencyIdsProvided) {
      const dependencyError = await validateDependencies(dependencyIds, current.module_id, id);
      if (dependencyError) {
        return res.status(dependencyError.status).json({ message: dependencyError.message });
      }
    }

    // prepare update values using provided fields or existing values
    const updateTitle = title !== undefined ? title : current.title;
    const updateType = type !== undefined ? type : current.type;
    const updateRequiredHours = required_hours !== undefined ? required_hours : current.required_hours;
    const updateDependencyTaskId = dependencyIdsProvided ? (dependencyIds[0] || null) : current.dependency_task_id;
    const updateNotes = notes !== undefined ? notes : current.notes;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // update task in database
      const result = await client.query(
        'UPDATE tasks SET title = $1, type = $2, required_hours = $3, start_date = $4, end_date = $5, dependency_task_id = $6, notes = $7 WHERE id = $8 RETURNING *',
        [updateTitle, updateType, updateRequiredHours, finalStart, finalEnd, updateDependencyTaskId, updateNotes, id]
      );
      if (dependencyIdsProvided) {
        await replaceDependencies(client, id, dependencyIds);
        result.rows[0].dependency_task_ids = dependencyIds;
      }
      await client.query('COMMIT');
      return res.status(200).json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('update task error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// delete a task
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // delete task from tasks table with ownership verification
    const result = await pool.query(
      'DELETE FROM tasks USING modules WHERE tasks.id = $1 AND tasks.module_id = modules.id AND modules.user_id = $2 RETURNING tasks.id',
      [id, userId]
    );

    // return 404 if task not found
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'task not found' });
    }

    return res.status(200).json({ message: 'task deleted successfully' });
  } catch (error) {
    console.error('delete task error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

module.exports = { getTasksByModule, createTask, updateTask, deleteTask };
