require('dotenv').config();
const { Pool } = require('pg');

// create connection pool to postgresql database
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// log successful database connection
pool.on('connect', () => {
  console.log('connected to postgresql database');
});

// log database connection errors
pool.on('error', (err) => {
  console.error('unexpected error on idle client', err);
});

module.exports = pool;
