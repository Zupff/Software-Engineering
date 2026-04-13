const { pool } = require('../server');

// query all modules for current user ordered by deadline
const getAllModules = async (req, res) => {
  try {
    const userId = req.user.id;

    // get all modules for user ordered by deadline ascending
    const result = await pool.query(
      'SELECT * FROM modules WHERE user_id = $1 ORDER BY deadline ASC',
      [userId]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('get all modules error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// query single module by id with nested tasks
const getModuleById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // get module by id and user id
    const moduleResult = await pool.query(
      'SELECT * FROM modules WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    // return 404 if module not found
    if (moduleResult.rows.length === 0) {
      return res.status(404).json({ message: 'module not found' });
    }

    // get all tasks for this module
    const tasksResult = await pool.query(
      'SELECT * FROM tasks WHERE module_id = $1',
      [id]
    );

    // attach tasks array to module object
    const module = moduleResult.rows[0];
    module.tasks = tasksResult.rows;

    return res.status(200).json(module);
  } catch (error) {
    console.error('get module by id error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// update module deadline
const updateModuleDeadline = async (req, res) => {
  try {
    const { id } = req.params;
    const { deadline } = req.body;
    const userId = req.user.id;

    // validate that deadline is a valid date
    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      return res.status(400).json({ message: 'invalid date format' });
    }

    // update module deadline in database
    const result = await pool.query(
      'UPDATE modules SET deadline = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [deadline, id, userId]
    );

    // return 404 if no module was updated
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'module not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('update module deadline error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

module.exports = { getAllModules, getModuleById, updateModuleDeadline };
