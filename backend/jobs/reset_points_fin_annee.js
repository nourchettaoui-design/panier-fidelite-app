// Réinitialise les points au changement d'année (exécuter une fois après le 31 décembre); currently zeroes points for all non-deleted cards (works)

require('dotenv').config();
const pool = require('../db');

(async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const q = `
            UPDATE paniers_fidelite
            SET points   = 0,
                date_maj = now()
            WHERE supprime = false
              AND points > 0;
        `;
        const res = await client.query(q);
        await client.query('COMMIT');
        console.log('Reset points fin d\'année terminé. Lignes affectées:',
            res.rowCount);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur reset points:', err.message || err);
        process.exitCode = 1;
    } finally {
        client.release();
    }
})();
