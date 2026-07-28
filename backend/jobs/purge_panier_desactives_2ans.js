// Supprime définitivement les paniers désactivés depuis plus de 2 ans; deletes permanently paniers_fidelite where date_desactivation older than 2 years

require('dotenv').config();
const pool = require('../db');

(async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const q = `
      DELETE FROM paniers_fidelite
      WHERE actif = false
        AND date_desactivation IS NOT NULL
        AND date_desactivation < (now() - INTERVAL '2 years')
      RETURNING id, utilisateur_id;
    `;
        const res = await client.query(q);
        await client.query('COMMIT');
        console.log('Purge terminée. Paniers supprimés:', res.rowCount);
        if (res.rowCount > 0) console.log('Exemples:', res.rows.slice(0,10));
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur purge:', err.message || err);
        process.exitCode = 1;
    } finally {
        client.release();
    }
})();
