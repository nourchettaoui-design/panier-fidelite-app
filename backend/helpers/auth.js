// backend/helpers/auth.js
const pool = require('../db');

const hasActiveCart = async (userId) => {
    const q = `
    SELECT COUNT(*)::int AS cnt
    FROM paniers_fidelite
    WHERE utilisateur_id = $1
      AND actif = true
      AND (supprime = false OR supprime IS NULL)
  `;
    const r = await pool.query(q, [userId]);
    const cnt = (r.rows[0] && r.rows[0].cnt) ? Number(r.rows[0].cnt) : 0;
    return cnt > 0;
};

module.exports = { hasActiveCart };
