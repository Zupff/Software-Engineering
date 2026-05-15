const jwt = require('jsonwebtoken');
const pool = require('../db');

// middleware to verify jwt token from authorization header AND that the
// user it references still exists. Without the existence check.
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorised: invalid or missing token' });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify the user row still exists. If the user has been deleted, the
    // JWT is stale and we want the client to log out cleanly.
    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [decoded.id]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Unauthorised: session expired, please sign in again' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorised: invalid or missing token' });
  }
};

module.exports = authMiddleware;
