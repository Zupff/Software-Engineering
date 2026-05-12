const pool = require('../db');

// returns everything the Gantt page needs for the logged-in user in one
// payload: modules with deadlines, tasks with dates and dependencies,
// and per-task hours logged so the bar can show progress fill.
const getGantt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { semester_id } = req.query;

    const modulesResult = semester_id
      ? await pool.query(
          'SELECT id, module_code, module_name, assessment_type, deadline, weighting FROM modules WHERE user_id = $1 AND semester_id = $2 ORDER BY deadline ASC',
          [userId, semester_id]
        )
      : await pool.query(
          'SELECT id, module_code, module_name, assessment_type, deadline, weighting FROM modules WHERE user_id = $1 ORDER BY deadline ASC',
          [userId]
        );

    const moduleIds = modulesResult.rows.map(m => m.id);
    if (moduleIds.length === 0) {
      return res.status(200).json({ modules: [], tasks: [] });
    }

    const tasksResult = await pool.query(
      `SELECT t.id, t.module_id, t.title, t.type, t.required_hours,
              t.start_date, t.end_date, t.dependency_task_id, t.notes
         FROM tasks t
        WHERE t.module_id = ANY($1::int[])
        ORDER BY t.start_date NULLS LAST, t.id`,
      [moduleIds]
    );

    // Hours logged per task in one query — sessions now link to tasks
    // via the session_tasks junction, and each linked task receives full
    // credit for the session's duration.
    const sessionsResult = await pool.query(
      `SELECT st.task_id,
              COALESCE(SUM(s.duration_hours), 0) AS hours_logged
         FROM study_sessions s
         JOIN session_tasks  st ON st.session_id = s.id
        WHERE s.user_id = $1
        GROUP BY st.task_id`,
      [userId]
    );

    const hoursByTask = {};
    sessionsResult.rows.forEach(row => {
      hoursByTask[row.task_id] = parseFloat(row.hours_logged);
    });

    const tasks = tasksResult.rows.map(t => {
      const required = parseFloat(t.required_hours) || 0;
      const logged   = hoursByTask[t.id] || 0;
      const percentage = required > 0 ? Math.min(100, Math.round((logged / required) * 100)) : 0;
      return {
        id: t.id,
        module_id: t.module_id,
        title: t.title,
        type: t.type,
        required_hours: required,
        hours_logged: logged,
        percentage,
        start_date: t.start_date,
        end_date: t.end_date,
        dependency_task_id: t.dependency_task_id,
        notes: t.notes,
      };
    });

    return res.status(200).json({
      modules: modulesResult.rows,
      tasks,
    });
  } catch (error) {
    console.error('get gantt error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

module.exports = { getGantt };
