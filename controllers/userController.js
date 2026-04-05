const db = require('../config/db');

exports.getIndex = async (req, res) => {
  try {
    const [equipment] = await db.query('SELECT * FROM equipment ORDER BY created_at DESC');
    res.render('user/index', { equipment, title: 'Heritage Tools' });
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
};

exports.submitRequest = async (req, res) => {
  try {
    const { equipment_id, equipment_name, user_name, quantity, duration_type, duration_value, purpose } = req.body;
    const now = new Date();
    let returnDate = new Date(now);
    if (duration_type === 'hours') {
      returnDate.setHours(returnDate.getHours() + parseInt(duration_value));
    } else {
      returnDate.setDate(returnDate.getDate() + parseInt(duration_value));
    }
    await db.query(
      'INSERT INTO borrow_requests (equipment_id, equipment_name, user_name, quantity, duration_type, duration_value, return_date, purpose) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [equipment_id, equipment_name, user_name || 'User', quantity, duration_type, duration_value, returnDate, purpose]
    );
    res.redirect('/?success=1');
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
};