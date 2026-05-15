const pool = require('../db');

// helper function to calculate module progress and status. 

const calculateProgress = async (userId, semesterId) => {
  const modulesResult = semesterId
    ? await pool.query(
        'SELECT * FROM modules WHERE user_id = $1 AND semester_id = $2',
        [userId, semesterId]
      )
    : await pool.query(
        'SELECT * FROM modules WHERE user_id = $1',
        [userId]
      );

  // calculate progress for each module
  const progress = await Promise.all(
    modulesResult.rows.map(async (module) => {
      // sum all hours logged for this module
      const hoursResult = await pool.query(
        'SELECT COALESCE(SUM(duration_hours), 0) as total_hours FROM study_sessions WHERE module_id = $1 AND user_id = $2',
        [module.id, userId]
      );

      const hoursLogged = parseFloat(hoursResult.rows[0].total_hours);

      // sum required hours from this module's tasks. 
      // progress is measured against the workload the student has actually planned, not a
      // hardcoded constant.
      const requiredResult = await pool.query(
        'SELECT COALESCE(SUM(required_hours), 0) as total_required FROM tasks WHERE module_id = $1',
        [module.id]
      );

      const hoursRequired = parseFloat(requiredResult.rows[0].total_required);

      // if no tasks have been planned yet, show 0% rather than dividing by 0
      const percentage = hoursRequired > 0
        ? Math.min((hoursLogged / hoursRequired) * 100, 100)
        : 0;

      // calculate days until deadline
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadline = new Date(module.deadline);
      deadline.setHours(0, 0, 0, 0);
      const daysUntilDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

      // determine status. brief specifies completed / upcoming / missed;
      // 'Due Soon' is a sub-category of upcoming for deadlines within a
      // week. 
      let status;
      if (percentage >= 100) {
        status = 'Completed';
      } else if (daysUntilDeadline < 0) {
        status = 'Missed';
      } else if (daysUntilDeadline <= 7) {
        status = 'Due Soon';
      } else {
        status = 'On Track';
      }

      return {
        id: module.id,
        module_code: module.module_code,
        module_name: module.module_name,
        deadline: module.deadline,
        hours_logged: hoursLogged,
        hours_required: hoursRequired,
        percentage: Math.round(percentage),
        status: status,
      };
    })
  );

  return progress;
};

// get progress for all modules for logged in user
// get dashboard summary with counts and deadline arrays
const getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const { semester_id } = req.query;

    // calculate progress for all modules 
    const progress = await calculateProgress(userId, semester_id);

    // calculate summary counts
    const total_modules = progress.length;
    const completed = progress.filter(m => m.status === 'Completed').length;
    const missed = progress.filter(m => m.status === 'Missed').length;
    const upcoming = total_modules - completed - missed;

    // create deadline arrays sorted by deadline ascending
    const upcoming_deadlines = progress
      .filter(m => m.status !== 'Missed' && m.status !== 'Completed')
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const completed_deadlines = progress
      .filter(m => m.status === 'Completed')
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const missed_deadlines = progress
      .filter(m => m.status === 'Missed')
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    // return dashboard summary
    return res.status(200).json({
      total_modules: total_modules,
      completed: completed,
      missed: missed,
      upcoming: upcoming,
      progress: progress,
      upcoming_deadlines: upcoming_deadlines,
      completed_deadlines: completed_deadlines,
      missed_deadlines: missed_deadlines,
    });
  } catch (error) {
    console.error('get dashboard error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

module.exports = { getDashboard };
