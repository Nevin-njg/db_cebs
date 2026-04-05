const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function initDB() {
  try {
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS equipment (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        icon VARCHAR(20) DEFAULT NULL,
        total_quantity INT NOT NULL DEFAULT 1,
        available_quantity INT NOT NULL DEFAULT 1,
        status ENUM('available', 'limited', 'unavailable') DEFAULT 'available',
        specifications TEXT,
        next_available VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS borrow_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        equipment_id INT NOT NULL,
        equipment_name VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL DEFAULT 'User',
        quantity INT NOT NULL DEFAULT 1,
        duration_type ENUM('hours', 'days') NOT NULL DEFAULT 'days',
        duration_value INT NOT NULL DEFAULT 1,
        return_date DATETIME NOT NULL,
        purpose TEXT,
        status ENUM('pending', 'approved', 'rejected', 'returned') DEFAULT 'pending',
        rejection_reason VARCHAR(255),
        rejection_details TEXT,
        approved_at DATETIME DEFAULT NULL,
        rejected_at DATETIME DEFAULT NULL,
        returned_at DATETIME DEFAULT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
      )
    `);

    // Seed admin user if no users exist
    const [userRows] = await promisePool.query('SELECT COUNT(*) as count FROM users');
    if (userRows[0].count === 0) {
      await promisePool.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Administrator', 'admin@heritage.com', hashPassword('admin123'), 'admin']
      );
      console.log('✅ Default admin created: admin@heritage.com / admin123');
    }

    // Seed equipment if empty
    const [eqRows] = await promisePool.query('SELECT COUNT(*) as count FROM equipment');
    if (eqRows[0].count === 0) {
      await promisePool.query(`
        INSERT INTO equipment (name, category, icon, total_quantity, available_quantity, status, specifications) VALUES
        ('Cordless Drill', 'Power Tools', '🔧', 5, 3, 'available', 'Voltage: 20V, Speed: 0-1500 RPM'),
        ('Safety Helmet', 'Safety Equipment', '🪖', 20, 0, 'unavailable', 'ANSI certified, Weight: 400g'),
        ('Measuring Tape', 'Measuring Tools', '📏', 15, 12, 'available', 'Length: 25m, Material: Steel'),
        ('Circular Saw', 'Power Tools', '🪚', 3, 1, 'limited', 'Blade: 7.25 inch, Power: 1800W'),
        ('Work Gloves', 'Safety Equipment', '🧤', 50, 42, 'available', 'Material: Leather and Cotton'),
        ('Level Tool', 'Measuring Tools', '📐', 10, 7, 'available', 'Length: 24 inch, Accuracy: 0.5mm')
      `);
    }

    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Database init error:', err.message);
  }
}

initDB();

module.exports = promisePool;