const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login } = require('../controllers/authController');

const router = express.Router();

// generous limit so a classroom demo with shared IP can re-sign-in repeatedly
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many accounts created, please try again later' },
});

router.post('/api/register', registerLimiter, register);
router.post('/api/login', loginLimiter, login);

module.exports = router;
