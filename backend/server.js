require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const path = require('path');

// fail fast if jwt secret is missing or weak
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long');
}

// initialize express app
const app = express();

// security headers
app.use(helmet({
  contentSecurityPolicy: false, // disabled for inline scripts in current pages
}));

// middleware
app.use(express.json({ limit: '50kb' }));

// serve static frontend files from public/ only
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// serve Index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'Index.html'));
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

// import gantt routes
const ganttRoutes = require('./routes/gantt');
app.use(ganttRoutes);

// import semester routes
const semesterRoutes = require('./routes/semesters');
app.use(semesterRoutes);

// import milestone routes
const milestoneRoutes = require('./routes/milestones');
app.use(milestoneRoutes);

// import profile routes
const profileRoutes = require('./routes/profile');
app.use(profileRoutes);

// health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// start server on configured port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`server is running on port ${port}`);

  // Ensure the demo user (demo / demo123) exists on every boot so any
  // teammate can clone the repo, start the server, and log in immediately.
  // Idempotent — won't duplicate an existing row.
  const { ensureDemoUser, DEMO_USERNAME } = require('./scripts/seed');
  ensureDemoUser()
    .then(u => console.log(`demo user ready: ${DEMO_USERNAME} (id=${u.id})`))
    .catch(err => console.error('demo user seed failed:', err.message));
});

module.exports = app;
