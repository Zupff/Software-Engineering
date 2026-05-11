const express = require('express');
const { listSemesters, currentSemester, createSemester, deleteSemester } = require('../controllers/semesterController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/api/semesters',         authMiddleware, listSemesters);
router.get('/api/semesters/current', authMiddleware, currentSemester);
router.post('/api/semesters',        authMiddleware, createSemester);
router.delete('/api/semesters/:id',  authMiddleware, deleteSemester);

module.exports = router;
