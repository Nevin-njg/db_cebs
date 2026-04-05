const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');
const { requireUser, requireAdmin } = require('../middleware/auth');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ─── EQUIPMENT ────────────────────────────────────────────────────────────────

// GET all equipment
router.get('/equipment', requireUser, async (req, res) => {
  try {
    const { search, category, status } = req.query;
    let sql = 'SELECT * FROM equipment WHERE 1=1';
    const params = [];
    let idx = 1;

    if (search)   { sql += ` AND name ILIKE $${idx++}`;   params.push(`%${search}%`); }
    if (category) { sql += ` AND category = $${idx++}`;   params.push(category); }
    if (status)   { sql += ` AND status = $${idx++}`;     params.push(status); }

    sql += ' ORDER BY created_at DESC';

    const result = await db.query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST add equipment
router.post('/equipment', requireAdmin, async (req, res) => {
  try {
    const { name, category, icon, total_quantity, available_quantity, status, specifications, next_available } = req.body;

    const result = await db.query(
      `INSERT INTO equipment (name, category, icon, total_quantity, available_quantity, status, specifications, next_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, category, icon || null, total_quantity, available_quantity, status, specifications, next_available || null]
    );

    res.json({ success: true, id: result.rows[0].id, message: 'Equipment added successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update equipment
router.put('/equipment/:id', requireAdmin, async (req, res) => {
  try {
    const { name, category, icon, total_quantity, available_quantity, status, specifications, next_available } = req.body;

    await db.query(
      `UPDATE equipment SET name=$1, category=$2, icon=$3, total_quantity=$4, available_quantity=$5,
       status=$6, specifications=$7, next_available=$8 WHERE id=$9`,
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
    const item = await db.query('SELECT name FROM equipment WHERE id=$1', [req.params.id]);
    await db.query('DELETE FROM equipment WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: `${item.rows[0]?.name} deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── REQUESTS ─────────────────────────────────────────────────────────────────

// GET all requests (admin)
router.get('/requests', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM borrow_requests WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      sql += ` AND status = $1`;
      params.push(status);
    }

    sql += ' ORDER BY submitted_at DESC';

    const result = await db.query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET my requests (user)
router.get('/my-requests', requireUser, async (req, res) => {
  try {
    const userName = req.session.user.name;
    const result = await db.query(
      'SELECT * FROM borrow_requests WHERE user_name = $1 ORDER BY submitted_at DESC',
      [userName]
    );
    res.json({ success: true, data: result.rows });
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

    const result = await db.query(
      `INSERT INTO borrow_requests
       (equipment_id, equipment_name, user_name, quantity, duration_type, duration_value, return_date, purpose)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [equipment_id, equipment_name, user.name, quantity, duration_type, duration_value, returnDate.toISOString(), purpose]
    );

    res.json({ success: true, id: result.rows[0].id, message: 'Request submitted successfully', return_date: returnDate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT approve request (admin)
router.put('/requests/:id/approve', requireAdmin, async (req, res) => {
  try {
    const reqResult = await db.query('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id]);
    if (!reqResult.rows.length) return res.status(404).json({ success: false, message: 'Request not found' });
    const request = reqResult.rows[0];

    const eqResult = await db.query('SELECT * FROM equipment WHERE id=$1', [request.equipment_id]);
    if (!eqResult.rows.length) return res.status(404).json({ success: false, message: 'Equipment not found' });
    const eq = eqResult.rows[0];

    if (eq.available_quantity < request.quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient quantity available' });
    }

    await db.query(
      "UPDATE borrow_requests SET status='approved', approved_at=NOW() WHERE id=$1",
      [req.params.id]
    );

    const newAvail = eq.available_quantity - request.quantity;
    const newStatus = newAvail === 0 ? 'unavailable' : newAvail <= 2 ? 'limited' : 'available';

    await db.query(
      'UPDATE equipment SET available_quantity=$1, status=$2 WHERE id=$3',
      [newAvail, newStatus, request.equipment_id]
    );

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
      "UPDATE borrow_requests SET status='rejected', rejection_reason=$1, rejection_details=$2, rejected_at=NOW() WHERE id=$3",
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
    const reqResult = await db.query('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id]);
    if (!reqResult.rows.length) return res.status(404).json({ success: false, message: 'Request not found' });
    const request = reqResult.rows[0];

    await db.query(
      "UPDATE borrow_requests SET status='returned', returned_at=NOW() WHERE id=$1",
      [req.params.id]
    );

    const eqResult = await db.query('SELECT * FROM equipment WHERE id=$1', [request.equipment_id]);
    if (eqResult.rows.length) {
      const eq = eqResult.rows[0];
      const newAvail = Math.min(eq.available_quantity + request.quantity, eq.total_quantity);
      const newStatus = newAvail === 0 ? 'unavailable' : newAvail <= 2 ? 'limited' : 'available';

      await db.query(
        'UPDATE equipment SET available_quantity=$1, status=$2, next_available=NULL WHERE id=$3',
        [newAvail, newStatus, request.equipment_id]
      );
    }

    res.json({ success: true, message: `${request.equipment_name} marked as returned` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET history (admin)
router.get('/history', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM borrow_requests WHERE status IN ('approved','returned') ORDER BY submitted_at DESC"
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── USER MANAGEMENT (admin) ──────────────────────────────────────────────────

// GET all users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST add user
router.post('/users', requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length) return res.json({ success: false, message: 'Email already registered' });

    await db.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
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

    const existing = await db.query(
      'SELECT id FROM users WHERE email=$1 AND id!=$2',
      [email, req.params.id]
    );
    if (existing.rows.length) return res.json({ success: false, message: 'Email already in use' });

    if (password) {
      await db.query(
        'UPDATE users SET name=$1, email=$2, password=$3, role=$4 WHERE id=$5',
        [name, email, hashPassword(password), role, req.params.id]
      );
    } else {
      await db.query(
        'UPDATE users SET name=$1, email=$2, role=$3 WHERE id=$4',
        [name, email, role, req.params.id]
      );
    }

    res.json({ success: true, message: `${name} updated successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE user
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await db.query('SELECT name FROM users WHERE id=$1', [req.params.id]);
    if (!user.rows.length) return res.json({ success: false, message: 'User not found' });

    await db.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: `${user.rows[0].name} deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;