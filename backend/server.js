require('dotenv').config();
const express = require('express');
const pool = require('./db');
const path = require('path');

// initialize express app
const app = express();

// middleware
app.use(express.json());

// serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// import auth routes
const authRoutes = require('./routes/auth');
app.use(authRoutes);

// import import routes
const importRoutes = require('./routes/import');
app.use(importRoutes);

// import module routes
const moduleRoutes = require('./routes/modules');
app.use(moduleRoutes);

// import task routes
const taskRoutes = require('./routes/tasks');
app.use(taskRoutes);

// import session routes
const sessionRoutes = require('./routes/sessions');
app.use(sessionRoutes);

// import dashboard routes
const dashboardRoutes = require('./routes/dashboard');
app.use(dashboardRoutes);

// seed test user for development
app.post('/api/seed', async (req, res) => {
  try {
    const bcrypt = require('bcrypt');
    const jwt = require('jsonwebtoken');
    
    // hash password
    const hashedPassword = await bcrypt.hash('demo123', 10);
    
    // try to insert test user
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (username) DO UPDATE SET password_hash = $3 RETURNING id, username',
      ['demo', 'demo@example.com', hashedPassword]
    );
    
    const user = result.rows[0];
    
    // create token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ message: 'Demo user created/updated', username: 'demo', password: 'demo123', token });
  } catch (error) {
    console.error('seed error:', error);
    res.status(500).json({ error: error.message });
  }
});

// health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// start server on configured port
const port = 3000;
app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});

module.exports = app;
