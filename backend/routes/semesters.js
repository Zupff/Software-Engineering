const express = require('express');
const { listSemesters, createSemester, deleteSemester } = require('../controllers/semesterController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/api/semesters',         authMiddleware, listSemesters);
router.post('/api/semesters',        authMiddleware, createSemester);
router.delete('/api/semesters/:id',  authMiddleware, deleteSemester);

module.exports = router;
