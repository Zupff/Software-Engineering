const { pool } = require('../server');

// helper function to calculate module progress and status
const calculateProgress = async (userId) => {
  // query all modules for user
  const modulesResult = await pool.query(
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

      // calculate percentage complete capped at 100
      const percentage = Math.min((hoursLogged / 20) * 100, 100);

      // calculate days until deadline
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadline = new Date(module.deadline);
      deadline.setHours(0, 0, 0, 0);
      const daysUntilDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

      // determine status based on deadline and progress
      let status;
      if (daysUntilDeadline < 0 && percentage < 100) {
        status = 'Missed';
      } else if (daysUntilDeadline >= 0 && daysUntilDeadline <= 7) {
        status = 'Due Soon';
      } else if (daysUntilDeadline > 7) {
        // calculate expected progress based on days remaining
        const expectedProgress = Math.max(0, (1 - (daysUntilDeadline / 7)) * 100);
        if (percentage < expectedProgress) {
          status = 'Behind Schedule';
        } else {
          status = 'On Track';
        }
      } else {
        status = 'On Track';
      }

      return {
        module_code: module.module_code,
        module_name: module.module_name,
        deadline: module.deadline,
        hours_logged: hoursLogged,
        percentage: Math.round(percentage),
        status: status,
      };
    })
  );

  return progress;
};

// get progress for all modules for logged in user
const getProgress = async (req, res) => {
  try {
    const userId = req.user.id;

    // calculate progress for all modules
    const progress = await calculateProgress(userId);

    return res.status(200).json(progress);
  } catch (error) {
    console.error('get progress error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

// get dashboard summary with counts and deadline arrays
const getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // calculate progress for all modules
    const progress = await calculateProgress(userId);

    // calculate summary counts
    const total_modules = progress.length;
    const completed = progress.filter(m => m.percentage === 100).length;
    const missed = progress.filter(m => m.status === 'Missed').length;
    const upcoming = total_modules - completed - missed;

    // create deadline arrays sorted by deadline ascending
    const upcoming_deadlines = progress
      .filter(m => m.status !== 'Missed' && m.percentage !== 100)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const completed_deadlines = progress
      .filter(m => m.percentage === 100)
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

module.exports = { getProgress, getDashboard };
