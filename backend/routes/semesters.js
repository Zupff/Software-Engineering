const express = require('express');
const {
    listSemesters, createSemester, deleteSemester, deleteAllSemesters,
} = require('../controllers/semesterController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/api/semesters',         authMiddleware, listSemesters);
router.post('/api/semesters',        authMiddleware, createSemester);
// Bulk delete must be declared before the :id variant so 'semesters' isn't
// caught by the param matcher.
router.delete('/api/semesters',      authMiddleware, deleteAllSemesters);
router.delete('/api/semesters/:id',  authMiddleware, deleteSemester);

module.exports = router;
