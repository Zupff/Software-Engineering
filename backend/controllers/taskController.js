const pool = require('../db');

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

// create a new task
const createTask = async (req, res) => {
  try {
    const { module_id, title, type, required_hours, dependency_task_id, notes } = req.body;
    const userId = req.user.id;

    // validate required fields are present
    if (!module_id || !title || !type || required_hours === undefined) {
      return res.status(400).json({ message: 'module_id title type and required_hours are required' });
    }

    // validate required_hours is a positive number
    if (isNaN(required_hours) || required_hours <= 0) {
      return res.status(400).json({ message: 'required_hours must be a positive number' });
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
      'INSERT INTO tasks (module_id, title, type, required_hours, dependency_task_id, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [module_id, title, type, required_hours, dependency_task_id || null, notes || null]
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
    const { title, type, required_hours, dependency_task_id, notes } = req.body;
    const userId = req.user.id;

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

    // prepare update values using provided fields or existing values
    const updateTitle = title !== undefined ? title : current.title;
    const updateType = type !== undefined ? type : current.type;
    const updateRequiredHours = required_hours !== undefined ? required_hours : current.required_hours;
    const updateDependencyTaskId = dependency_task_id !== undefined ? dependency_task_id : current.dependency_task_id;
    const updateNotes = notes !== undefined ? notes : current.notes;

    // update task in database
    const result = await pool.query(
      'UPDATE tasks SET title = $1, type = $2, required_hours = $3, dependency_task_id = $4, notes = $5 WHERE id = $6 RETURNING *',
      [updateTitle, updateType, updateRequiredHours, updateDependencyTaskId || null, updateNotes, id]
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
