# Setup Instructions

## Prerequisites
- Node.js installed
- PostgreSQL installed and running
- Database created (or use the migration script)

## Backend Setup

1. **Create `.env` file** in the `backend/` directory with your database credentials:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Then edit `.env` with your PostgreSQL credentials:
   - `DB_HOST`: Usually `localhost`
   - `DB_PORT`: Usually `5432`
   - `DB_USER`: Your PostgreSQL user
   - `DB_PASSWORD`: Your PostgreSQL password
   - `DB_NAME`: Name of your database
   - `JWT_SECRET`: Any random string (used for token signing)

2. **Create database schema**:
   ```bash
   psql -U your_user -d your_database -f create_database.sql
   ```

3. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

4. **Start server**:
   ```bash
   npm start
   ```
   The server will run on `http://localhost:3000`

5. **Seed demo user** (optional):
   Make a POST request to `http://localhost:3000/api/seed` to create the demo user with credentials:
   - Username: `demo`
   - Password: `demo123`

## Login
Use these credentials to log in:
- Username: `demo`
- Password: `demo123`
