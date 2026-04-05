const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function initDB() {
  const client = await pool.connect();
  try {
    console.log('🔄 Initializing Supabase PostgreSQL database...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS equipment (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        icon VARCHAR(20) DEFAULT NULL,
        total_quantity INT NOT NULL DEFAULT 1,
        available_quantity INT NOT NULL DEFAULT 1,
        status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'limited', 'unavailable')),
        specifications TEXT,
        next_available VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS borrow_requests (
        id SERIAL PRIMARY KEY,
        equipment_id INT NOT NULL,
        equipment_name VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL DEFAULT 'User',
        quantity INT NOT NULL DEFAULT 1,
        duration_type VARCHAR(50) NOT NULL DEFAULT 'days' CHECK (duration_type IN ('hours', 'days')),
        duration_value INT NOT NULL DEFAULT 1,
        return_date TIMESTAMP NOT NULL,
        purpose TEXT,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'returned')),
        rejection_reason VARCHAR(255),
        rejection_details TEXT,
        approved_at TIMESTAMP DEFAULT NULL,
        rejected_at TIMESTAMP DEFAULT NULL,
        returned_at TIMESTAMP DEFAULT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
      )
    `);

    const userResult = await client.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(userResult.rows[0].count) === 0) {
      await client.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
        ['Administrator', 'admin@heritage.com', hashPassword('admin123'), 'admin']
      );
      console.log('✅ Default admin created: admin@heritage.com / admin123');
    }

    const equipResult = await client.query('SELECT COUNT(*) as count FROM equipment');
    if (parseInt(equipResult.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO equipment (name, category, icon, total_quantity, available_quantity, status, specifications) VALUES
        ('Cordless Drill', 'Power Tools', '🔧', 5, 3, 'available', 'Voltage: 20V, Speed: 0-1500 RPM'),
        ('Safety Helmet', 'Safety Equipment', '🪖', 20, 0, 'unavailable', 'ANSI certified, Weight: 400g'),
        ('Measuring Tape', 'Measuring Tools', '📏', 15, 12, 'available', 'Length: 25m, Material: Steel'),
        ('Circular Saw', 'Power Tools', '🪚', 3, 1, 'limited', 'Blade: 7.25 inch, Power: 1800W'),
        ('Work Gloves', 'Safety Equipment', '🧤', 50, 42, 'available', 'Material: Leather and Cotton'),
        ('Level Tool', 'Measuring Tools', '📐', 10, 7, 'available', 'Length: 24 inch, Accuracy: 0.5mm')
      `);
      console.log('✅ Sample equipment seeded');
    }

    console.log('✅ Database initialized successfully with Supabase PostgreSQL');
  } catch (err) {
    console.error('❌ Database init error:', err.message);
  } finally {
    client.release();
  }
}

initDB();

module.exports = pool;