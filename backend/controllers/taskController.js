const pool = require('../db');

// allowed task types — kept in sync with the dropdown on the Tasks page.
// validated on both create and update so a malicious or buggy client
// can't insert arbitrary strings.
const ALLOWED_TASK_TYPES = ['Studying', 'Reading', 'Writing', 'Programming', 'Planning', 'Reviewing'];

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
      'SELECT * FROM tasks WHERE module_id = $1',
      [module_id]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('get tasks by module error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// helper: returns a normalised ISO date string if `value` is a valid date,
// or null if the value is missing/empty, or undefined to signal an error
function parseDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

// create a new task
const createTask = async (req, res) => {
  try {
    const { module_id, title, type, required_hours, start_date, end_date, dependency_task_id, notes } = req.body;
    const userId = req.user.id;

    // validate required fields are present
    if (!module_id || !title || !type || required_hours === undefined) {
      return res.status(400).json({ message: 'module_id title type and required_hours are required' });
    }

    // validate type against the allowed set
    if (!ALLOWED_TASK_TYPES.includes(type)) {
      return res.status(400).json({
        message: 'type must be one of: ' + ALLOWED_TASK_TYPES.join(', ')
      });
    }

    // validate required_hours is a positive number
    if (isNaN(required_hours) || required_hours <= 0) {
      return res.status(400).json({ message: 'required_hours must be a positive number' });
    }

    // validate start_date / end_date if provided, and that start <= end
    const startISO = parseDate(start_date);
    const endISO   = parseDate(end_date);
    if (startISO === undefined) {
      return res.status(400).json({ message: 'start_date is not a valid date' });
    }
    if (endISO === undefined) {
      return res.status(400).json({ message: 'end_date is not a valid date' });
    }
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

    // if dependency_task_id is provided validate it exists in the same module
    if (dependency_task_id) {
      const dependencyResult = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND module_id = $2',
        [dependency_task_id, module_id]
      );

      if (dependencyResult.rows.length === 0) {
        return res.status(404).json({ message: 'dependency task not found in this module' });
      }
    }

    // insert new task into tasks table
    const result = await pool.query(
      'INSERT INTO tasks (module_id, title, type, required_hours, start_date, end_date, dependency_task_id, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [module_id, title, type, required_hours, startISO, endISO, dependency_task_id || null, notes || null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('create task error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// update an existing task
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, required_hours, start_date, end_date, dependency_task_id, notes } = req.body;
    const userId = req.user.id;

    // validate type against the allowed set if provided
    if (type !== undefined && !ALLOWED_TASK_TYPES.includes(type)) {
      return res.status(400).json({
        message: 'type must be one of: ' + ALLOWED_TASK_TYPES.join(', ')
      });
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
      if (startISO === undefined) {
        return res.status(400).json({ message: 'start_date is not a valid date' });
      }
    }
    let endISO;
    if (end_date !== undefined) {
      endISO = parseDate(end_date);
      if (endISO === undefined) {
        return res.status(400).json({ message: 'end_date is not a valid date' });
      }
    }
    const finalStart = start_date !== undefined ? startISO : current.start_date;
    const finalEnd   = end_date   !== undefined ? endISO   : current.end_date;
    if (finalStart && finalEnd && new Date(finalStart) > new Date(finalEnd)) {
      return res.status(400).json({ message: 'start_date must be on or before end_date' });
    }

    // if a new dependency is provided, validate it: must not be self,
    // must exist, must belong to the same module, AND must not introduce
    // a transitive cycle (A -> B -> A).
    if (dependency_task_id !== undefined && dependency_task_id !== null) {
      if (Number(dependency_task_id) === Number(id)) {
        return res.status(400).json({ message: 'task cannot depend on itself' });
      }

      const dependencyResult = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND module_id = $2',
        [dependency_task_id, current.module_id]
      );

      if (dependencyResult.rows.length === 0) {
        return res.status(404).json({ message: 'dependency task not found in this module' });
      }

      // Walk the chain: starting from the proposed dependency, follow each
      // task's own dependency_task_id. If we ever land back on the task
      // being updated, it's a cycle — reject. Cap at 50 hops just in case.
      let cursor = Number(dependency_task_id);
      for (let i = 0; i < 50 && cursor; i++) {
        if (cursor === Number(id)) {
          return res.status(400).json({
            message: 'this dependency would create a circular chain',
          });
        }
        const step = await pool.query(
          'SELECT dependency_task_id FROM tasks WHERE id = $1',
          [cursor]
        );
        cursor = step.rows[0] && step.rows[0].dependency_task_id;
      }
    }

    // prepare update values using provided fields or existing values
    const updateTitle = title !== undefined ? title : current.title;
    const updateType = type !== undefined ? type : current.type;
    const updateRequiredHours = required_hours !== undefined ? required_hours : current.required_hours;
    const updateDependencyTaskId = dependency_task_id !== undefined ? dependency_task_id : current.dependency_task_id;
    const updateNotes = notes !== undefined ? notes : current.notes;

    // update task in database
    const result = await pool.query(
      'UPDATE tasks SET title = $1, type = $2, required_hours = $3, start_date = $4, end_date = $5, dependency_task_id = $6, notes = $7 WHERE id = $8 RETURNING *',
      [updateTitle, updateType, updateRequiredHours, finalStart, finalEnd, updateDependencyTaskId || null, updateNotes, id]
    );

    return res.status(200).json(result.rows[0]);
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
