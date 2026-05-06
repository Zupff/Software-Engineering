require('dotenv').config();
const express = require('express');
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
