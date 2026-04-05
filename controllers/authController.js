const db = require('../config/db');
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

exports.getLogin = (req, res) => {
  res.render('auth/login', { title: 'Login - Heritage Tools', error: null });
};

exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      return res.render('auth/login', { title: 'Login - Heritage Tools', error: 'Invalid email or password' });
    }
    const user = rows[0];
    if (user.password !== hashPassword(password)) {
      return res.render('auth/login', { title: 'Login - Heritage Tools', error: 'Invalid email or password' });
    }
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    if (user.role === 'admin') return res.redirect('/admin/dashboard');
    res.redirect('/');
  } catch (err) {
    res.render('auth/login', { title: 'Login - Heritage Tools', error: 'Server error: ' + err.message });
  }
};

exports.getRegister = (req, res) => {
  res.render('auth/register', { title: 'Register - Heritage Tools', error: null });
};

exports.postRegister = async (req, res) => {
  const { name, email, password, confirm_password } = req.body;
  if (password !== confirm_password) {
    return res.render('auth/register', { title: 'Register - Heritage Tools', error: 'Passwords do not match' });
  }
  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.render('auth/register', { title: 'Register - Heritage Tools', error: 'Email already registered' });
    }
    const hashed = hashPassword(password);
    await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "user")', [name, email, hashed]);
    res.redirect('/auth/login?registered=1');
  } catch (err) {
    res.render('auth/register', { title: 'Register - Heritage Tools', error: 'Server error: ' + err.message });
  }
};

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
};