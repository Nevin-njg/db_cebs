const db = require('../config/db');

exports.getIndex = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM equipment ORDER BY created_at DESC');
    res.render('user/index', {
      equipment: result.rows,
      title: 'Heritage Tools',
      sessionUser: req.session.user
    });
  } catch (err) {
    console.error('Database error in getIndex:', err);
    res.status(500).send('Server error: ' + err.message);
  }
};

exports.submitRequest = async (req, res) => {
  try {
    const { equipment_id, equipment_name, quantity, duration_type, duration_value, purpose } = req.body;

    // Get user name from session — never from body (security)
    const user_name = req.session.user ? req.session.user.name : 'User';

    if (!equipment_id || !equipment_name || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const now = new Date();
    let returnDate = new Date(now);

    if (duration_type === 'hours') {
      returnDate.setHours(returnDate.getHours() + parseInt(duration_value));
    } else {
      returnDate.setDate(returnDate.getDate() + parseInt(duration_value));
    }

    await db.query(
      `INSERT INTO borrow_requests 
       (equipment_id, equipment_name, user_name, quantity, duration_type, duration_value, return_date, purpose)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        parseInt(equipment_id),
        equipment_name,
        user_name,
        parseInt(quantity),
        duration_type || 'days',
        parseInt(duration_value) || 1,
        returnDate.toISOString(),
        purpose || null
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Database error in submitRequest:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const user_name = req.session.user ? req.session.user.name : 'User';
    const result = await db.query(
      'SELECT * FROM borrow_requests WHERE user_name=$1 ORDER BY submitted_at DESC',
      [user_name]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getMyRequests error:', err);
    res.status(500).json({ error: err.message });
  }
};