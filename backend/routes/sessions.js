const express = require('express');
const { logSession, getSessionsByModule } = require('../controllers/sessionController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// log a new study session
router.post('/api/sessions', authMiddleware, logSession);

// get all sessions for a module
router.get('/api/sessions', authMiddleware, getSessionsByModule);

module.exports = router;
