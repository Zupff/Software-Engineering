const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { pool } = require('../server');

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

    // start database transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // insert each row into modules table
      for (const row of rows) {
        await client.query(
          'INSERT INTO modules (user_id, module_code, module_name, assessment_type, deadline, weighting) VALUES ($1, $2, $3, $4, $5, $6)',
          [userId, row.module_code, row.module_name, row.assessment_type, row.deadline, parseInt(row.weighting)]
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
