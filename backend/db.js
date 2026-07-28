/*
 Minimal DB pool that loads backend/.env explicitly and uses DB_* env vars (falls back to DATABASE_URL/PG*).
*/
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// load .env from the backend folder explicitly
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Helpful debug — remove or comment out in production
if (!process.env.DB_USER && !process.env.DATABASE_URL && !process.env.PGUSER) {
  console.warn('Warning: DB_USER / DATABASE_URL / PGUSER not set — pg will try OS user. Set DB_USER in backend/.env to enforce the DB role.');
}

const poolConfig = {};
if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;

  if (process.env.NODE_ENV === 'production') {
    poolConfig.ssl = {
      rejectUnauthorized: false
    };
  }
} else {
  poolConfig.host = process.env.DB_HOST || process.env.PGHOST || 'localhost';
  poolConfig.port = process.env.DB_PORT ? Number(process.env.DB_PORT) : (process.env.PGPORT ? Number(process.env.PGPORT) : 5432);
  poolConfig.user = process.env.DB_USER || process.env.PGUSER;
  poolConfig.password = process.env.DB_PASSWORD || process.env.PGPASSWORD;
  poolConfig.database = process.env.DB_NAME || process.env.PGDATABASE || 'panier_fidelite_db';
}

// Optional pool tuning
poolConfig.max = poolConfig.max || 10;
poolConfig.idleTimeoutMillis = poolConfig.idleTimeoutMillis || 30000;
poolConfig.connectionTimeoutMillis = poolConfig.connectionTimeoutMillis || 5000;

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});

// Optional quick self-check — will print connected DB user and DB name.
(async function _selfCheck() {
  try {
    const r = await pool.query("SELECT current_user AS user, current_database() AS db");
    console.log('DB connection OK:', r.rows[0]);
  } catch (err) {
    console.error('DB self-check failed:', err.message);
  }
})();

module.exports = pool;
