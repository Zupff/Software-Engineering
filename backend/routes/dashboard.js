const express = require('express');
const { getProgress, getDashboard } = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// get progress for all modules
router.get('/api/progress', authMiddleware, getProgress);

// get dashboard with summary counts and deadline arrays
router.get('/api/dashboard', authMiddleware, getDashboard);

module.exports = router;
