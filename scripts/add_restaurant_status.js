/**
 * One-time migration script: adds `status` column to restaurants table.
 * Run with: node scripts/add_restaurant_status.js
 */
require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔗 Connected to database');

    // Check if column already exists
    const check = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'restaurants' AND column_name = 'status'
    `);

    if (check.rows.length > 0) {
      console.log('✅ Column `status` already exists in restaurants table. Nothing to do.');
    } else {
      await client.query(`
        ALTER TABLE restaurants
        ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active'
      `);
      console.log('✅ Column `status` added to restaurants table with default value "active".');
    }

    // Verify
    const verify = await client.query(`SELECT COUNT(*) as count FROM restaurants`);
    console.log(`📊 Total restaurants: ${verify.rows[0].count}`);

    const statusCheck = await client.query(`SELECT status, COUNT(*) as count FROM restaurants GROUP BY status`);
    console.log('Status breakdown:', statusCheck.rows);

  } finally {
    client.release();
    await pool.end();
    console.log('🔒 Connection closed.');
  }
}

run().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
