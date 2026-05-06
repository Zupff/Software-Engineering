require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db');

const DEMO_USERNAME = 'demo';
const DEMO_EMAIL = 'demo@example.com';

async function seed() {
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    console.error('DEMO_PASSWORD env var is required (set it in .env, do not commit it)');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool.query(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id, username',
    [DEMO_USERNAME, DEMO_EMAIL, hashedPassword]
  );

  console.log(`demo user ready: id=${result.rows[0].id} username=${result.rows[0].username}`);
  await pool.end();
}

seed().catch((err) => {
  console.error('seed failed:', err);
  pool.end();
  process.exit(1);
});
