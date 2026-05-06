-- stores user account information and authentication details
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  display_name VARCHAR,
  course VARCHAR,
  avatar_id VARCHAR,
  avatar_color VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- a semester study profile groups a set of modules under an academic period
CREATE TABLE semesters (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR NOT NULL,
  academic_year VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, name)
);

-- stores module information for each user including assessment details
CREATE TABLE modules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  semester_id INTEGER REFERENCES semesters(id) ON DELETE CASCADE,
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
  start_date DATE,
  end_date DATE,
  dependency_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  notes TEXT,
  CONSTRAINT tasks_dates_order CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
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

-- many-to-many: each milestone is achieved by completing a set of tasks,
-- and a single task may contribute to more than one milestone.
CREATE TABLE milestone_tasks (
  milestone_id INTEGER REFERENCES milestones(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (milestone_id, task_id)
);

