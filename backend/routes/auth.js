const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { register, login } = require('../controllers/authController');

const router = express.Router();

// Build a friendly retry-after message from the rate-limit info attached
// to req. 
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

// 60 logins / 15 min per IP — classroom shared IP can re-sign-in repeatedly.
// Counts every login response success & fail 
const loginLimiterIp = rateLimit({
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

// Defends against targeted brute-force where an attacker rotates IPs to bypass
// the IP limiter. Successful logins reset the counter so a teammate
// typing the wrong password a few times during demo prep isn't punished
// once they get it right.
const loginLimiterUsername = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: false,
  legacyHeaders: false,
  // Use express-rate-limit's IPv6-safe helper when falling back to IP.
  keyGenerator: (req) =>
    (req.body && req.body.username || '').toString().trim().toLowerCase() || ('ip:' + ipKeyGenerator(req.ip)),
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(429).json({
      message: retryAfterMessage('Too many failed attempts for this username', req),
    });
  },
});


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
// IP limiter runs first as a coarse filter; username limiter is finer-grained
router.post('/api/login', loginLimiterIp, loginLimiterUsername, login);

module.exports = router;
