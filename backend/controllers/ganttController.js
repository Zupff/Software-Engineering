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
              t.start_date, t.end_date, t.dependency_task_id, t.notes,  -- gather task information
              -- dependencies are stored in a junction table so a task can
              -- depend on more than one prerequisite task.
              COALESCE(
                ARRAY_AGG(td.dependency_task_id) FILTER (WHERE td.dependency_task_id IS NOT NULL), 
                CASE WHEN t.dependency_task_id IS NOT NULL
                  THEN ARRAY[t.dependency_task_id]              -- place dependencies into an array
                  ELSE ARRAY[]::int[]        
                END
              ) AS dependency_task_ids
         FROM tasks t                               
         LEFT JOIN task_dependencies td ON td.task_id = t.id
        WHERE t.module_id = ANY($1::int[])
        GROUP BY t.id
        ORDER BY t.start_date NULLS LAST, t.id`,
      [moduleIds]
    );

   
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
        dependency_task_ids: t.dependency_task_ids || [],
        notes: t.notes,
      };
    });

    // Milestones with their linked task ids — rendered on the Gantt at
    // their deadline within the owning module's band. 
    const milestonesResult = await pool.query(
      `SELECT mi.id, mi.module_id, mi.title, mi.deadline,
              COALESCE(
                (SELECT array_agg(mt.task_id) FROM milestone_tasks mt WHERE mt.milestone_id = mi.id),
                ARRAY[]::int[]
              ) AS task_ids
         FROM milestones mi
        WHERE mi.module_id = ANY($1::int[])
        ORDER BY mi.deadline ASC`,
      [moduleIds]
    );

    return res.status(200).json({
      modules: modulesResult.rows,
      tasks,
      milestones: milestonesResult.rows,
    });
  } catch (error) {
    console.error('get gantt error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

module.exports = { getGantt };
