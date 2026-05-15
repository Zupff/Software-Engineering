const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// JWT lifetime: 1 day instead of 7. Shorter window = smaller blast radius
// if a token leaks. authenticatedFetch on the client logs the user out

const TOKEN_EXPIRY = '1d';

// Pre-computed dummy bcrypt hash. Used to equalise login response time
// when the username doesn't exist
// for valid usernames by timing the response.
const DUMMY_HASH = bcrypt.hashSync('this-is-not-a-real-password', 10);

// Helpers — usernames and emails are normalised to lowercase so 'Demo'
// and 'demo' refer to the same account.
const normUsername = (v) => (v || '').toString().trim().toLowerCase();
const normEmail    = (v) => (v || '').toString().trim().toLowerCase();

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // validate that all fields are present 
    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Could not create account' });
    }
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ message: 'Could not create account' });
    }
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Could not create account' });
    }
    if (password.length < 6 || password.length > 200) {
      return res.status(400).json({ message: 'Could not create account' });
    }

    const cleanUsername = normUsername(username);
    const cleanEmail    = normEmail(email);

    // check if username/email already exists 
    const userExists = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $2',
      [cleanUsername, cleanEmail]
    );
    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: 'Could not create account' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [cleanUsername, cleanEmail, hashedPassword]
    );

    const userId = result.rows[0].id;
    const token = jwt.sign(
      { id: userId, username: cleanUsername },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    return res.status(201).json({ token, userId });
  } catch (error) {
    console.error('register error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required' });
    }
    const cleanUsername = normUsername(username);

    // Case-insensitive lookup
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE LOWER(username) = $1',
      [cleanUsername]
    );

    // Always run bcrypt.compare to equalise timing. If the user doesn't
    // exist, compare against a fixed dummy hash so the response time is
    // indistinguishable from "user exists, wrong password".
    const hashToCompare = result.rows.length > 0
      ? result.rows[0].password_hash
      : DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (result.rows.length === 0 || !passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    return res.status(200).json({ token, userId: user.id });
  } catch (error) {
    console.error('login error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

module.exports = { register, login };
