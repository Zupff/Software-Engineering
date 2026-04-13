const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../server');

// register a new user with username email and password
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // validate that all fields are present
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username email and password are required' });
    }

    // check if username already exists in database
    const userExists = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: 'username or email already exists' });
    }

    // hash password using bcrypt with 10 salt rounds
    const hashedPassword = await bcrypt.hash(password, 10);

    // insert new user into users table
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [username, email, hashedPassword]
    );

    const userId = result.rows[0].id;

    // sign jwt token with user id and username with 7 day expiry
    const token = jwt.sign(
      { id: userId, username: username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // return 201 with token and user id
    return res.status(201).json({ token, userId });
  } catch (error) {
    console.error('register error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// login an existing user with username and password
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // validate that both fields are present
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required' });
    }

    // query database for user with matching username
    const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);

    // return 401 if user not found
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // compare provided password against stored password hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    // return 401 if passwords do not match
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // sign jwt token with user id and username with 7 day expiry
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // return 200 with token and user id
    return res.status(200).json({ token, userId: user.id });
  } catch (error) {
    console.error('login error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

module.exports = { register, login };
