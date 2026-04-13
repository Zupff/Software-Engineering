const pool = require('../db');

// log a new study session
const logSession = async (req, res) => {
  try {
    const { module_id, task_id, duration_hours, date_logged, notes } = req.body;
    const userId = req.user.id;

    // validate required fields are present
    if (module_id === undefined || duration_hours === undefined || !date_logged) {
      return res.status(400).json({ message: 'module_id duration_hours and date_logged are required' });
    }

    // validate duration_hours is a positive number greater than 0
    if (isNaN(duration_hours) || duration_hours <= 0) {
      return res.status(400).json({ message: 'duration_hours must be a positive number greater than 0' });
    }

    // validate date_logged is a valid date
    const sessionDate = new Date(date_logged);
    if (isNaN(sessionDate.getTime())) {
      return res.status(400).json({ message: 'date_logged must be a valid date' });
    }

    // insert session into study_sessions table
    const result = await pool.query(
      'INSERT INTO study_sessions (user_id, module_id, task_id, duration_hours, date_logged, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, module_id, task_id || null, duration_hours, date_logged, notes || null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('log session error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// get all sessions for a specific module
const getSessionsByModule = async (req, res) => {
  try {
    const { module_id } = req.query;
    const userId = req.user.id;

    // validate module_id query parameter is present
    if (!module_id) {
      return res.status(400).json({ message: 'module_id query parameter is required' });
    }

    // query study_sessions for all sessions matching module_id and user_id
    const result = await pool.query(
      'SELECT * FROM study_sessions WHERE module_id = $1 AND user_id = $2 ORDER BY date_logged DESC',
      [module_id, userId]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('get sessions by module error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

module.exports = { logSession, getSessionsByModule };
