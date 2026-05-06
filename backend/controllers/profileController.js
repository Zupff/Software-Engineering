const pool = require('../db');

// the avatar set the frontend offers. validated server-side so a malicious
// or buggy client can't insert arbitrary strings. keep in sync with the
// avatar grid in auth.js.
const ALLOWED_AVATARS = ['cap', 'book', 'atom', 'code', 'pencil', 'rocket'];

// preset colour palette (theme-friendly). same constraint applies.
const ALLOWED_COLORS = ['navy', 'slate', 'teal', 'amber', 'rose', 'plum'];

// curated UEA-school course list. accepted as-is when the user picks one;
// "Other" lets them type free text which we trim and length-cap.
const KNOWN_COURSES = require('./courseList');

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT id, username, email, display_name, course, avatar_id, avatar_color FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'user not found' });
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('get profile error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { display_name, course, avatar_id, avatar_color } = req.body;

    // each field is optional individually so the frontend can patch one
    // thing at a time, but at least one must be present
    if (display_name === undefined && course === undefined &&
        avatar_id === undefined && avatar_color === undefined) {
      return res.status(400).json({ message: 'no profile fields provided' });
    }

    let cleanName = null;
    if (display_name !== undefined) {
      if (typeof display_name !== 'string' || !display_name.trim()) {
        return res.status(400).json({ message: 'display_name cannot be empty' });
      }
      cleanName = display_name.trim();
      if (cleanName.length > 60) {
        return res.status(400).json({ message: 'display_name must be 60 characters or fewer' });
      }
    }

    let cleanCourse = null;
    if (course !== undefined) {
      if (course === null || course === '') {
        cleanCourse = null;
      } else if (typeof course !== 'string') {
        return res.status(400).json({ message: 'course must be a string' });
      } else {
        cleanCourse = course.trim().slice(0, 80);
      }
    }

    if (avatar_id !== undefined && avatar_id !== null && !ALLOWED_AVATARS.includes(avatar_id)) {
      return res.status(400).json({
        message: 'avatar_id must be one of: ' + ALLOWED_AVATARS.join(', ')
      });
    }
    if (avatar_color !== undefined && avatar_color !== null && !ALLOWED_COLORS.includes(avatar_color)) {
      return res.status(400).json({
        message: 'avatar_color must be one of: ' + ALLOWED_COLORS.join(', ')
      });
    }

    // build a partial update — only touch columns the caller actually sent
    const sets = [];
    const params = [];
    let i = 1;
    if (display_name !== undefined)  { sets.push('display_name = $' + i++);  params.push(cleanName); }
    if (course       !== undefined)  { sets.push('course = $' + i++);        params.push(cleanCourse); }
    if (avatar_id    !== undefined)  { sets.push('avatar_id = $' + i++);     params.push(avatar_id || null); }
    if (avatar_color !== undefined)  { sets.push('avatar_color = $' + i++);  params.push(avatar_color || null); }
    params.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i}
         RETURNING id, username, email, display_name, course, avatar_id, avatar_color`,
      params
    );
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('update profile error', error);
    return res.status(500).json({ message: 'internal server error' });
  }
};

const listCourses = (_req, res) => {
  return res.status(200).json(KNOWN_COURSES);
};

module.exports = { getProfile, updateProfile, listCourses, ALLOWED_AVATARS, ALLOWED_COLORS };
