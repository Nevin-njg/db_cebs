const db = require('../config/db');

exports.getDashboard = async (req, res) => {
  try {
    res.render('admin/dashboard', { title: 'Admin - Dashboard' });
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
};

exports.getEquipment = async (req, res) => {
  try {
    const [equipment] = await db.query('SELECT * FROM equipment ORDER BY created_at DESC');
    res.render('admin/equipment', { equipment, title: 'Admin - Equipment' });
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
};

exports.getRequests = async (req, res) => {
  try {
    const [requests] = await db.query('SELECT * FROM borrow_requests ORDER BY submitted_at DESC');
    res.render('admin/requests', { requests, title: 'Admin - Requests' });
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
};

exports.getHistory = async (req, res) => {
  try {
    const [history] = await db.query(
      'SELECT * FROM borrow_requests WHERE status IN ("approved","returned") ORDER BY submitted_at DESC'
    );
    res.render('admin/history', { history, title: 'Admin - History' });
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
};

exports.getUsers = async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.*, COUNT(b.id) as request_count
      FROM users u
      LEFT JOIN borrow_requests b ON b.user_name = u.name
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.render('admin/users', { users, title: 'Admin - Users' });
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
};