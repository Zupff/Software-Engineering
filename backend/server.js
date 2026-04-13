require('dotenv').config();
const express = require('express');
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

// initialize express app
const app = express();

// middleware
app.use(express.json());

// import auth routes
const authRoutes = require('./routes/auth');
app.use(authRoutes);

// import import routes
const importRoutes = require('./routes/import');
app.use(importRoutes);

// health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// start server on configured port
const port = 3000;
app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});

// export pool for use in other files
module.exports = { pool, app };
