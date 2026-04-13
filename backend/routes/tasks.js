const express = require('express');
const { getTasksByModule, createTask, updateTask, deleteTask } = require('../controllers/taskController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// get all tasks for a module
router.get('/api/tasks', authMiddleware, getTasksByModule);

// create a new task
router.post('/api/tasks', authMiddleware, createTask);

// update a task
router.patch('/api/tasks/:id', authMiddleware, updateTask);

// delete a task
router.delete('/api/tasks/:id', authMiddleware, deleteTask);

module.exports = router;
