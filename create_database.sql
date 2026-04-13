-- stores user account information and authentication details
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- stores module information for each user including assessment details
CREATE TABLE modules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  module_code VARCHAR NOT NULL,
  module_name VARCHAR NOT NULL,
  assessment_type VARCHAR NOT NULL,
  deadline DATE NOT NULL,
  weighting INTEGER
);

-- stores individual tasks or assignments for each module
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  required_hours NUMERIC NOT NULL,
  dependency_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  notes TEXT
);

-- tracks study sessions logged by users for modules and tasks
CREATE TABLE study_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  duration_hours NUMERIC NOT NULL,
  date_logged DATE NOT NULL,
  notes TEXT
);

-- stores major milestones and checkpoints for modules
CREATE TABLE milestones (
  id SERIAL PRIMARY KEY,
  module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  deadline DATE NOT NULL
);

