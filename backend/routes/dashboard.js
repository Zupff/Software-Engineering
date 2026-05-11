const express = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// get dashboard with summary counts and deadline arrays
router.get('/api/dashboard', authMiddleware, getDashboard);

module.exports = router;
