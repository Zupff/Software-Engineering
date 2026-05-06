const express = require('express');
const { getGantt } = require('../controllers/ganttController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/api/gantt', authMiddleware, getGantt);

module.exports = router;
