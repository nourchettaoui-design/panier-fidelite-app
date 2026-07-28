// Désactive les paniers expirés (date_expiration < CURRENT_DATE); updates actif=false for rows where date_expiration < CURRENT_DATE (good)
require('dotenv').config();
const pool = require('../db');

(async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const q = `
            UPDATE paniers_fidelite
            SET actif                = false,
                date_desactivation   = now(),
                raison_desactivation = 'expiration',
                date_maj             = now()
            WHERE actif = true
              AND date_expiration IS NOT NULL
              AND date_expiration < CURRENT_DATE
              AND supprime = false;
        `;
        const res = await client.query(q);
        await client.query('COMMIT');
        console.log('Reconciliation quotidienne: paniers désactivés =',
            res.rowCount);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur reconciliation:', err.message || err);
        process.exitCode = 1;
    } finally {
        client.release();
    }
})();
