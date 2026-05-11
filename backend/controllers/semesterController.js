const pool = require('../db');

// list semesters for the authenticated user, newest first
const listSemesters = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT id, name, academic_year, created_at FROM semesters WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('list semesters error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// create a new semester. returns the existing one if a semester with the
// same name already exists for this user, since the import flow uses the
// semester name as a natural key.
const createSemester = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, academic_year } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }
    const cleanName = name.trim();
    if (cleanName.length > 100) {
      return res.status(400).json({ message: 'name must be 100 characters or fewer' });
    }
    const cleanYear = (academic_year || '').toString().trim() || null;

    const result = await pool.query(
      `INSERT INTO semesters (user_id, name, academic_year)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, name) DO UPDATE
         SET academic_year = COALESCE(EXCLUDED.academic_year, semesters.academic_year)
       RETURNING id, name, academic_year, created_at`,
      [userId, cleanName, cleanYear]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('create semester error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// delete a semester owned by the current user. Modules cascade-delete via
// FK ON DELETE CASCADE on semesters(id), so tasks and study_sessions go too.
const deleteSemester = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM semesters WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'semester not found' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('delete semester error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

module.exports = { listSemesters, createSemester, deleteSemester };
