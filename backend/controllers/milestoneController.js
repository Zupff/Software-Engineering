const pool = require('../db');

// Confirm a module belongs to the authenticated user. Returns the
// module id on success, throws an error string otherwise so callers can
// short-circuit with a 404.
async function assertModuleOwnership(client, moduleId, userId) {
  const result = await client.query(
    'SELECT id FROM modules WHERE id = $1 AND user_id = $2',
    [moduleId, userId]
  );
  if (result.rows.length === 0) {
    const err = new Error('module not found');
    err.status = 404;
    throw err;
  }
  return moduleId;
}

// If the given task ids, keep only the ones that actually belong
// to the supplied module. Used to filter out cross-module attempts before
// inserting into milestone_tasks.
async function filterTasksInModule(client, taskIds, moduleId) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) return [];
  const result = await client.query(
    'SELECT id FROM tasks WHERE module_id = $1 AND id = ANY($2::int[])',
    [moduleId, taskIds]
  );
  return result.rows.map(r => r.id);
}

// list milestones for a module.  Each row includes its linked task ids so the frontend can
// resolve them locally.
const listMilestones = async (req, res) => {
  try {
    const userId = req.user.id;
    const { module_id } = req.query;

    const params = [userId];
    let where = 'm.user_id = $1';
    if (module_id) {
      params.push(module_id);
      where += ' AND mi.module_id = $' + params.length;
    }

    const result = await pool.query(
      `SELECT mi.id, mi.module_id, mi.title, mi.deadline,
              COALESCE(
                (SELECT array_agg(mt.task_id) FROM milestone_tasks mt WHERE mt.milestone_id = mi.id),
                '{}'::int[]
              ) AS task_ids
         FROM milestones mi
         JOIN modules m ON m.id = mi.module_id
        WHERE ${where}
        ORDER BY mi.deadline ASC`,
      params
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('list milestones error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// create a milestone, optionally linking a set of contributing tasks.
const createMilestone = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { module_id, title, deadline, task_ids } = req.body;

    if (!module_id || !title || !deadline) {
      return res.status(400).json({ message: 'module_id, title and deadline are required' });
    }
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'title is required' });
    }
    const cleanTitle = title.trim();
    if (cleanTitle.length > 200) {
      return res.status(400).json({ message: 'title must be 200 characters or fewer' });
    }
    const dl = new Date(deadline);
    if (isNaN(dl.getTime())) {
      return res.status(400).json({ message: 'deadline is not a valid date' });
    }

    await client.query('BEGIN');
    await assertModuleOwnership(client, module_id, userId);

    const inserted = await client.query(
      'INSERT INTO milestones (module_id, title, deadline) VALUES ($1, $2, $3) RETURNING id, module_id, title, deadline',
      [module_id, cleanTitle, deadline]
    );
    const milestone = inserted.rows[0];

    const validTaskIds = await filterTasksInModule(client, task_ids, module_id);
    for (const tid of validTaskIds) {
      await client.query(
        'INSERT INTO milestone_tasks (milestone_id, task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [milestone.id, tid]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ ...milestone, task_ids: validTaskIds });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error('create milestone error', error);
    return res.status(500).json({ message: 'internal server error' });
  } finally {
    client.release();
  }
};

// update a milestone. if
// task_ids is provided, the whole link set is replaced.
const updateMilestone = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, deadline, task_ids } = req.body;

    await client.query('BEGIN');

    const currentResult = await client.query(
      `SELECT mi.id, mi.module_id, mi.title, mi.deadline
         FROM milestones mi
         JOIN modules m ON m.id = mi.module_id
        WHERE mi.id = $1 AND m.user_id = $2`,
      [id, userId]
    );
    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'milestone not found' });
    }
    const current = currentResult.rows[0];

    let newTitle = current.title;
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'title cannot be empty' });
      }
      newTitle = title.trim();
      if (newTitle.length > 200) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'title must be 200 characters or fewer' });
      }
    }

    let newDeadline = current.deadline;
    if (deadline !== undefined) {
      const dl = new Date(deadline);
      if (isNaN(dl.getTime())) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'deadline is not a valid date' });
      }
      newDeadline = deadline;
    }

    await client.query(
      'UPDATE milestones SET title = $1, deadline = $2 WHERE id = $3',
      [newTitle, newDeadline, id]
    );

    if (task_ids !== undefined) {
      const validTaskIds = await filterTasksInModule(client, task_ids, current.module_id);
      await client.query('DELETE FROM milestone_tasks WHERE milestone_id = $1', [id]);
      for (const tid of validTaskIds) {
        await client.query(
          'INSERT INTO milestone_tasks (milestone_id, task_id) VALUES ($1, $2)',
          [id, tid]
        );
      }
    }

    await client.query('COMMIT');

    const refreshed = await pool.query(
      `SELECT id, module_id, title, deadline,
              COALESCE(
                (SELECT array_agg(mt.task_id) FROM milestone_tasks mt WHERE mt.milestone_id = milestones.id),
                '{}'::int[]
              ) AS task_ids
         FROM milestones WHERE id = $1`,
      [id]
    );
    return res.status(200).json(refreshed.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('update milestone error', error);
    return res.status(500).json({ message: 'internal server error' });
  } finally {
    client.release();
  }
};

const deleteMilestone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM milestones
         USING modules
        WHERE milestones.id = $1
          AND milestones.module_id = modules.id
          AND modules.user_id = $2
        RETURNING milestones.id`,
      [id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'milestone not found' });
    }
    return res.status(200).json({ message: 'milestone deleted' });
  } catch (error) {
    console.error('delete milestone error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

module.exports = { listMilestones, createMilestone, updateMilestone, deleteMilestone };
