// Demo-user seed. Idempotent: safe to run on every server boot.
//
// The demo credentials are intentionally well-known so any teammate can
// clone the repo and sign in immediately — this is a coursework project
// where the marker and the team all need a working account out of the box.
// You can override the password via DEMO_PASSWORD in .env if you want.

require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db');

const DEMO_USERNAME = 'demo';
const DEMO_EMAIL    = 'demo@example.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo123';

// Reusable function callable from server.js on boot, or the `npm run seed` CLI.
async function ensureDemoUser() {
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ON CONFLICT (username) DO UPDATE means the password is always reset to
  // the canonical demo value on boot — so even if someone has rotated the
  // password or the row drifted, the next server restart fixes it.
  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, username`,
    [DEMO_USERNAME, DEMO_EMAIL, hashedPassword]
  );

  return result.rows[0];
}

module.exports = { ensureDemoUser, DEMO_USERNAME, DEMO_PASSWORD };

// When run directly (`node scripts/seed.js` or `npm run seed`) we exit
// after seeding. When required by server.js, the module export is used
// and the pool stays open.
if (require.main === module) {
  ensureDemoUser()
    .then(user => {
      console.log(`demo user ready: id=${user.id} username=${user.username}`);
      return pool.end();
    })
    .catch(err => {
      console.error('seed failed:', err);
      pool.end();
      process.exit(1);
    });
}
