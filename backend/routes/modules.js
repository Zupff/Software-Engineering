const express = require('express');
const { getAllModules, getModuleById, updateModuleDeadline } = require('../controllers/moduleController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// get all modules for current user
router.get('/api/modules', authMiddleware, getAllModules);

// get single module by id with tasks
router.get('/api/modules/:id', authMiddleware, getModuleById);

// update module deadline
router.patch('/api/modules/:id', authMiddleware, updateModuleDeadline);

module.exports = router;
