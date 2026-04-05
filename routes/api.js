const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');
const { requireUser, requireAdmin } = require('../middleware/auth');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// GET all equipment
router.get('/equipment', requireUser, async (req, res) => {
  try {
    const { search, category, status } = req.query;
    let sql = 'SELECT * FROM equipment WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND name LIKE ?'; params.push(`%${search}%`); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST add equipment
router.post('/equipment', requireAdmin, async (req, res) => {
  try {
    const { name, category, icon, total_quantity, available_quantity, status, specifications, next_available } = req.body;
    const [result] = await db.query(
      'INSERT INTO equipment (name, category, icon, total_quantity, available_quantity, status, specifications, next_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, category, icon || null, total_quantity, available_quantity, status, specifications, next_available || null]
    );
    res.json({ success: true, id: result.insertId, message: 'Equipment added successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update equipment
router.put('/equipment/:id', requireAdmin, async (req, res) => {
  try {
    const { name, category, icon, total_quantity, available_quantity, status, specifications, next_available } = req.body;
    await db.query(
      'UPDATE equipment SET name=?, category=?, icon=?, total_quantity=?, available_quantity=?, status=?, specifications=?, next_available=? WHERE id=?',
      [name, category, icon || null, total_quantity, available_quantity, status, specifications, next_available || null, req.params.id]
    );
    res.json({ success: true, message: 'Equipment updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE equipment
router.delete('/equipment/:id', requireAdmin, async (req, res) => {
  try {
    const [item] = await db.query('SELECT name FROM equipment WHERE id=?', [req.params.id]);
    await db.query('DELETE FROM equipment WHERE id=?', [req.params.id]);
    res.json({ success: true, message: `${item[0]?.name} deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all requests (admin)
router.get('/requests', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM borrow_requests WHERE 1=1';
    const params = [];
    if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY submitted_at DESC';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET my requests (user) — fixed to use user_name from session
router.get('/my-requests', requireUser, async (req, res) => {
  try {
    const userName = req.session.user.name;
    const [rows] = await db.query(
      'SELECT * FROM borrow_requests WHERE user_name = ? ORDER BY submitted_at DESC',
      [userName]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST submit request (user)
router.post('/requests', requireUser, async (req, res) => {
  try {
    const { equipment_id, equipment_name, quantity, duration_type, duration_value, purpose } = req.body;
    const user = req.session.user;
    const now = new Date();
    let returnDate = new Date(now);
    if (duration_type === 'hours') returnDate.setHours(returnDate.getHours() + parseInt(duration_value));
    else returnDate.setDate(returnDate.getDate() + parseInt(duration_value));

    const [result] = await db.query(
      'INSERT INTO borrow_requests (equipment_id, equipment_name, user_name, quantity, duration_type, duration_value, return_date, purpose) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [equipment_id, equipment_name, user.name, quantity, duration_type, duration_value, returnDate, purpose]
    );
    res.json({ success: true, id: result.insertId, message: 'Request submitted successfully', return_date: returnDate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT approve request (admin)
router.put('/requests/:id/approve', requireAdmin, async (req, res) => {
  try {
    const [reqRows] = await db.query('SELECT * FROM borrow_requests WHERE id=?', [req.params.id]);
    if (!reqRows.length) return res.status(404).json({ success: false, message: 'Request not found' });
    const request = reqRows[0];
    const [eq] = await db.query('SELECT * FROM equipment WHERE id=?', [request.equipment_id]);
    if (!eq.length) return res.status(404).json({ success: false, message: 'Equipment not found' });
    if (eq[0].available_quantity < request.quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient quantity available' });
    }
    await db.query('UPDATE borrow_requests SET status="approved", approved_at=NOW() WHERE id=?', [req.params.id]);
    const newAvail = eq[0].available_quantity - request.quantity;
    const newStatus = newAvail === 0 ? 'unavailable' : newAvail <= 2 ? 'limited' : 'available';
    await db.query('UPDATE equipment SET available_quantity=?, status=? WHERE id=?', [newAvail, newStatus, request.equipment_id]);
    res.json({ success: true, message: `Request for ${request.equipment_name} approved` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT reject request (admin)
router.put('/requests/:id/reject', requireAdmin, async (req, res) => {
  try {
    const { rejection_reason, rejection_details } = req.body;
    await db.query(
      'UPDATE borrow_requests SET status="rejected", rejection_reason=?, rejection_details=?, rejected_at=NOW() WHERE id=?',
      [rejection_reason, rejection_details || null, req.params.id]
    );
    res.json({ success: true, message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT mark returned (admin)
router.put('/requests/:id/return', requireAdmin, async (req, res) => {
  try {
    const [reqRows] = await db.query('SELECT * FROM borrow_requests WHERE id=?', [req.params.id]);
    if (!reqRows.length) return res.status(404).json({ success: false, message: 'Request not found' });
    const request = reqRows[0];
    await db.query('UPDATE borrow_requests SET status="returned", returned_at=NOW() WHERE id=?', [req.params.id]);
    const [eq] = await db.query('SELECT * FROM equipment WHERE id=?', [request.equipment_id]);
    if (eq.length) {
      const newAvail = Math.min(eq[0].available_quantity + request.quantity, eq[0].total_quantity);
      const newStatus = newAvail === 0 ? 'unavailable' : newAvail <= 2 ? 'limited' : 'available';
      await db.query('UPDATE equipment SET available_quantity=?, status=?, next_available=NULL WHERE id=?', [newAvail, newStatus, request.equipment_id]);
    }
    res.json({ success: true, message: `${request.equipment_name} marked as returned` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET history (admin)
router.get('/history', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM borrow_requests WHERE status IN ("approved","returned") ORDER BY submitted_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== USER MANAGEMENT (admin) =====

// GET all users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST add user
router.post('/users', requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const [existing] = await db.query('SELECT id FROM users WHERE email=?', [email]);
    if (existing.length) return res.json({ success: false, message: 'Email already registered' });
    await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashPassword(password), role || 'user']
    );
    res.json({ success: true, message: `${name} added successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update user
router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const [existing] = await db.query('SELECT id FROM users WHERE email=? AND id!=?', [email, req.params.id]);
    if (existing.length) return res.json({ success: false, message: 'Email already in use' });
    if (password) {
      await db.query('UPDATE users SET name=?, email=?, password=?, role=? WHERE id=?',
        [name, email, hashPassword(password), role, req.params.id]);
    } else {
      await db.query('UPDATE users SET name=?, email=?, role=? WHERE id=?',
        [name, email, role, req.params.id]);
    }
    res.json({ success: true, message: `${name} updated successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE user
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const [user] = await db.query('SELECT name FROM users WHERE id=?', [req.params.id]);
    if (!user.length) return res.json({ success: false, message: 'User not found' });
    await db.query('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ success: true, message: `${user[0].name} deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;