const express = require('express');
const {
    getProfile, updateProfile, listCourses, deleteAccount,
} = require('../controllers/profileController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/api/profile',         authMiddleware, getProfile);
router.put('/api/profile',         authMiddleware, updateProfile);
router.delete('/api/account',      authMiddleware, deleteAccount);
// public so the registration form can populate the dropdown without auth
router.get('/api/profile/courses', listCourses);

module.exports = router;
