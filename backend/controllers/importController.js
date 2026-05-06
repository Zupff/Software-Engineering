const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const pool = require('../db');

// configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// import modules from csv file
const importCSV = async (req, res) => {
  try {
    // check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'no file provided' });
    }

    const userId = req.user.id;
    const rows = [];
    const requiredColumns = ['module_code', 'module_name', 'assessment_type', 'deadline', 'weighting'];
    let headerValidated = false;

    // create readable stream from file buffer
    const stream = Readable.from([req.file.buffer]);

    // parse csv and collect rows
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('headers', (headers) => {
          // validate that all required columns are present
          const missingColumns = requiredColumns.filter(col => !headers.includes(col));
          if (missingColumns.length > 0) {
            return reject(new Error(`missing columns: ${missingColumns.join(', ')}`));
          }
          headerValidated = true;
        })
        .on('data', (row) => {
          rows.push(row);
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    // validate every row before touching the database. row indices in
    // error messages are 1-based and refer to data rows (excluding the
    // header), matching how a user would count rows in their CSV.
    const errors = [];
    const cleanRows = [];
    rows.forEach((row, i) => {
      const rowNum = i + 1;
      const code = (row.module_code || '').trim();
      const name = (row.module_name || '').trim();
      const type = (row.assessment_type || '').trim();
      const deadline = (row.deadline || '').trim();
      const weightingRaw = (row.weighting || '').toString().trim();

      if (!code) errors.push(`row ${rowNum}: module_code is required`);
      else if (code.length > 20) errors.push(`row ${rowNum}: module_code exceeds 20 characters`);

      if (!name) errors.push(`row ${rowNum}: module_name is required`);
      else if (name.length > 200) errors.push(`row ${rowNum}: module_name exceeds 200 characters`);

      if (!type) errors.push(`row ${rowNum}: assessment_type is required`);

      const deadlineDate = new Date(deadline);
      if (!deadline || isNaN(deadlineDate.getTime())) {
        errors.push(`row ${rowNum}: deadline is not a valid date`);
      }

      const weighting = Number(weightingRaw);
      if (weightingRaw === '' || !Number.isFinite(weighting) || !Number.isInteger(weighting)) {
        errors.push(`row ${rowNum}: weighting must be an integer`);
      } else if (weighting < 0 || weighting > 100) {
        errors.push(`row ${rowNum}: weighting must be between 0 and 100`);
      }

      cleanRows.push({ code, name, type, deadline, weighting });
    });

    if (errors.length > 0) {
      return res.status(400).json({ message: 'invalid csv data', errors });
    }

    // start database transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // insert each validated row into modules table
      for (const row of cleanRows) {
        await client.query(
          'INSERT INTO modules (user_id, module_code, module_name, assessment_type, deadline, weighting) VALUES ($1, $2, $3, $4, $5, $6)',
          [userId, row.code, row.name, row.type, row.deadline, row.weighting]
        );
      }

      // commit transaction
      await client.query('COMMIT');

      // return 201 with count of modules imported
      return res.status(201).json({ message: `imported ${rows.length} modules`, count: rows.length });
    } catch (error) {
      // rollback transaction on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // release database connection
      client.release();
    }
  } catch (error) {
    console.error('import error', error);

    // check if error is from column validation
    if (error.message.startsWith('missing columns:')) {
      return res.status(400).json({ message: error.message });
    }

    // return 500 for database or other errors
    return res.status(500).json({ message: 'import failed' });
  }
};

module.exports = { upload, importCSV };
