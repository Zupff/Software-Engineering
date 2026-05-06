const express = require('express');
const {
    listMilestones,
    createMilestone,
    updateMilestone,
    deleteMilestone,
} = require('../controllers/milestoneController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/api/milestones',         authMiddleware, listMilestones);
router.post('/api/milestones',        authMiddleware, createMilestone);
router.put('/api/milestones/:id',     authMiddleware, updateMilestone);
router.delete('/api/milestones/:id',  authMiddleware, deleteMilestone);

module.exports = router;
