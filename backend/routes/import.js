const express = require('express');
const { upload, importCSV } = require('../controllers/importController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// import modules from csv file with auth protection
router.post('/api/import/csv', authMiddleware, upload.single('file'), importCSV);

module.exports = router;
