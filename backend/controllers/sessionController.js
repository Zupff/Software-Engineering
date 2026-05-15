const pool = require('../db');

// Log a new study session. The brief allows an activity to contribute to
// multiple tasks at once, so the API accepts task_ids. 
const logSession = async (req, res) => {
  try {
    const { module_id, task_ids, duration_hours, date_logged, notes } = req.body;
    const userId = req.user.id;

    if (module_id === undefined || duration_hours === undefined || !date_logged) {
      return res.status(400).json({ message: 'module_id duration_hours and date_logged are required' });
    }
    if (isNaN(duration_hours) || duration_hours <= 0) {
      return res.status(400).json({ message: 'duration_hours must be a positive number greater than 0' });
    }
    const sessionDate = new Date(date_logged);
    if (isNaN(sessionDate.getTime())) {
      return res.status(400).json({ message: 'date_logged must be a valid date' });
    }

    // verify module belongs to the authenticated user
    const moduleCheck = await pool.query(
      'SELECT id FROM modules WHERE id = $1 AND user_id = $2',
      [module_id, userId]
    );
    if (moduleCheck.rows.length === 0) {
      return res.status(404).json({ message: 'module not found' });
    }

    // Normalise task_ids: must be a non-empty array of task ids belonging
    // to this module. 
    const ids = Array.isArray(task_ids)
      ? Array.from(new Set(task_ids.map(n => Number(n)).filter(Number.isFinite)))
      : [];
    if (ids.length === 0) {
      return res.status(400).json({ message: 'task_ids must be a non-empty array' });
    }
    const taskCheck = await pool.query(
      'SELECT id FROM tasks WHERE id = ANY($1::int[]) AND module_id = $2',
      [ids, module_id]
    );
    if (taskCheck.rows.length !== ids.length) {
      return res.status(404).json({ message: 'one or more tasks do not belong to this module' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertSession = await client.query(
        `INSERT INTO study_sessions (user_id, module_id, duration_hours, date_logged, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, module_id, duration_hours, date_logged, notes`,
        [userId, module_id, duration_hours, date_logged, notes || null]
      );
      const session = insertSession.rows[0];

    
      for (const tid of ids) {
        await client.query(
          'INSERT INTO session_tasks (session_id, task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [session.id, tid]
        );
      }

      await client.query('COMMIT');
      session.task_ids = ids;
      return res.status(201).json(session);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('log session error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// All sessions for a module, with their linked task ids aggregated as an
// array so the frontend can compute task-level totals without a second roundtrip.
const getSessionsByModule = async (req, res) => {
  try {
    const { module_id } = req.query;
    const userId = req.user.id;

    if (!module_id) {
      return res.status(400).json({ message: 'module_id query parameter is required' });
    }

    const result = await pool.query(
      `SELECT s.id, s.user_id, s.module_id, s.duration_hours, s.date_logged, s.notes,
              COALESCE(
                ARRAY_AGG(st.task_id) FILTER (WHERE st.task_id IS NOT NULL),
                ARRAY[]::int[]
              ) AS task_ids
         FROM study_sessions s
         LEFT JOIN session_tasks st ON st.session_id = s.id
        WHERE s.module_id = $1 AND s.user_id = $2
        GROUP BY s.id
        ORDER BY s.date_logged DESC, s.id DESC`,
      [module_id, userId]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('get sessions by module error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

module.exports = { logSession, getSessionsByModule };
