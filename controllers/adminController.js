const db = require('../config/db'); // ✅ Only ONE require at the top

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const equipResult = await db.query('SELECT COUNT(*) as count FROM equipment');
    const reqResult = await db.query("SELECT COUNT(*) as count FROM borrow_requests WHERE status = 'pending'");
    const approvedResult = await db.query("SELECT COUNT(*) as count FROM borrow_requests WHERE status = 'approved'");
    const userResult = await db.query('SELECT COUNT(*) as count FROM users');

    res.render('admin/dashboard', {
      title: 'Admin - Dashboard',
      totalEquipment: equipResult.rows[0].count,
      pendingRequests: reqResult.rows[0].count,
      approvedRequests: approvedResult.rows[0].count,
      totalUsers: userResult.rows[0].count,
      sessionUser: req.session.user
    });
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
};

// ─── EQUIPMENT ────────────────────────────────────────────────────────────────
exports.getEquipment = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM equipment ORDER BY created_at DESC');
    res.render('admin/equipment', {
      equipment: result.rows,
      title: 'Admin - Equipment',
      sessionUser: req.session.user
    });
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
};

exports.addEquipment = async (req, res) => {
  try {
    const { name, category, icon, total_quantity, available_quantity, status, specifications, next_available } = req.body;

    if (!name || !category || !total_quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Auto-calculate status based on quantities if not explicitly set
    let computedStatus = status;
    if (!computedStatus) {
      if (parseInt(available_quantity) === 0) computedStatus = 'unavailable';
      else if (parseInt(available_quantity) < parseInt(total_quantity)) computedStatus = 'limited';
      else computedStatus = 'available';
    }

    await db.query(
      `INSERT INTO equipment (name, category, icon, total_quantity, available_quantity, status, specifications, next_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        name,
        category,
        icon || '🔧',
        parseInt(total_quantity),
        parseInt(available_quantity) || 0,
        computedStatus,
        specifications || null,
        next_available || null
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('addEquipment error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, icon, total_quantity, available_quantity, status, specifications, next_available } = req.body;

    let computedStatus = status;
    if (!computedStatus) {
      if (parseInt(available_quantity) === 0) computedStatus = 'unavailable';
      else if (parseInt(available_quantity) < parseInt(total_quantity)) computedStatus = 'limited';
      else computedStatus = 'available';
    }

    await db.query(
      `UPDATE equipment SET name=$1, category=$2, icon=$3, total_quantity=$4, available_quantity=$5,
       status=$6, specifications=$7, next_available=$8 WHERE id=$9`,
      [
        name,
        category,
        icon || '🔧',
        parseInt(total_quantity),
        parseInt(available_quantity),
        computedStatus,
        specifications || null,
        next_available || null,
        id
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('updateEquipment error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM equipment WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteEquipment error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── REQUESTS ─────────────────────────────────────────────────────────────────
exports.getRequests = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM borrow_requests WHERE status = 'pending' ORDER BY submitted_at DESC"
    );
    res.render('admin/requests', {
      requests: result.rows,
      title: 'Admin - Requests',
      sessionUser: req.session.user
    });
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;

    // Get request details first
    const reqResult = await db.query('SELECT * FROM borrow_requests WHERE id=$1', [id]);
    if (reqResult.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const request = reqResult.rows[0];

    // Deduct available quantity
    await db.query(
      'UPDATE equipment SET available_quantity = available_quantity - $1 WHERE id=$2',
      [request.quantity, request.equipment_id]
    );

    // Auto update equipment status
    await db.query(`
      UPDATE equipment SET status = CASE
        WHEN available_quantity = 0 THEN 'unavailable'
        WHEN available_quantity < total_quantity THEN 'limited'
        ELSE 'available'
      END WHERE id=$1
    `, [request.equipment_id]);

    // Approve the request
    await db.query(
      "UPDATE borrow_requests SET status='approved', approved_at=NOW() WHERE id=$1",
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('approveRequest error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason, rejection_details } = req.body;

    await db.query(
      "UPDATE borrow_requests SET status='rejected', rejection_reason=$1, rejection_details=$2, rejected_at=NOW() WHERE id=$3",
      [rejection_reason || 'Not specified', rejection_details || null, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('rejectRequest error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.markReturned = async (req, res) => {
  try {
    const { id } = req.params;

    const reqResult = await db.query('SELECT * FROM borrow_requests WHERE id=$1', [id]);
    if (reqResult.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const request = reqResult.rows[0];

    // Restore available quantity
    await db.query(
      'UPDATE equipment SET available_quantity = available_quantity + $1 WHERE id=$2',
      [request.quantity, request.equipment_id]
    );

    // Auto update equipment status
    await db.query(`
      UPDATE equipment SET status = CASE
        WHEN available_quantity = 0 THEN 'unavailable'
        WHEN available_quantity < total_quantity THEN 'limited'
        ELSE 'available'
      END WHERE id=$1
    `, [request.equipment_id]);

    await db.query(
      "UPDATE borrow_requests SET status='returned', returned_at=NOW() WHERE id=$1",
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('markReturned error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── HISTORY ──────────────────────────────────────────────────────────────────
exports.getHistory = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM borrow_requests WHERE status IN ('approved', 'returned', 'rejected') ORDER BY submitted_at DESC"
    );
    res.render('admin/history', {
      history: result.rows,
      title: 'Admin - History',
      sessionUser: req.session.user
    });
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
};

// ─── USERS ────────────────────────────────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.*, COUNT(b.id) as request_count
      FROM users u
      LEFT JOIN borrow_requests b ON b.user_name = u.name
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.render('admin/users', {
      users: result.rows,
      title: 'Admin - Users',
      sessionUser: req.session.user
    });
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM users WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ error: err.message });
  }
};