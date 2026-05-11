const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login } = require('../controllers/authController');

const router = express.Router();

// Build a friendly retry-after message from the rate-limit info attached
// to req. Express-rate-limit v7+ sets req.rateLimit.resetTime to a Date.
function retryAfterMessage(prefix, req) {
  const reset = req.rateLimit && req.rateLimit.resetTime;
  if (!reset) return prefix + '. Please try again later.';
  const ms = Math.max(0, reset.getTime() - Date.now());
  const minutes = Math.ceil(ms / 60000);
  if (minutes <= 1) return prefix + '. Please try again in a moment.';
  if (minutes < 60) return prefix + '. Please try again in ' + minutes + ' minutes.';
  const hours = Math.ceil(minutes / 60);
  return prefix + '. Please try again in ' + hours + ' hour' + (hours === 1 ? '' : 's') + '.';
}

// 60 logins / 15 min per IP — classroom shared IP can re-sign-in repeatedly
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: retryAfterMessage('Too many login attempts', req),
    });
  },
});

// 30 registrations / hour per IP — bumped from 10 so demo prep doesn't lock
// the team out of testing the signup flow
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: retryAfterMessage('Too many accounts created', req),
    });
  },
});

router.post('/api/register', registerLimiter, register);
router.post('/api/login', loginLimiter, login);

module.exports = router;
