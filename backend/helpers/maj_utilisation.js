const pool = require('../db');

/**
 * Met à jour last_utilisation et ajoute/soustrait des points sur un panier.
 * Utilisation inside a transaction is preferred, but this helper opens a client and uses transaction.
 *
 * @param {number} panierId
 * @param {Object} options { dateUtilisation: 'YYYY-MM-DD' or Date, deltaPoints: number, motif: string }
 */
async function majUtilisationEtPoints(panierId, { dateUtilisation = null, deltaPoints = 0, motif = null } = {}) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const nowDate = dateUtilisation ? new Date(dateUtilisation) : new Date();
        const dateStr = nowDate.toISOString().slice(0, 10); // YYYY-MM-DD

        // lock the panier row to avoid race conditions
        const qSelect = 'SELECT id, points FROM paniers_fidelite WHERE id = $1 FOR UPDATE';
        const res = await client.query(qSelect, [panierId]);
        if (res.rowCount === 0) {
            throw new Error('Panier non trouvé');
        }

        const currentPoints = res.rows[0].points || 0;
        const newPoints = currentPoints + Number(deltaPoints || 0);

        const qUpdate = `
      UPDATE paniers_fidelite
      SET points = $1,
          last_utilisation = $2,
          date_maj = now()
      WHERE id = $3
    `;
        await client.query(qUpdate, [newPoints, dateStr, panierId]);

        // insert transaction audit if needed
        if (deltaPoints !== 0) {
            const annee = nowDate.getFullYear();
            const qTx = `
        INSERT INTO points_transactions (panier_id, type, montant, motif, annee)
        VALUES ($1, $2, $3, $4, $5)
      `;
            const type = deltaPoints > 0 ? 'credit' : 'debit';
            await client.query(qTx, [panierId, type, deltaPoints, motif || null, annee]);
        }

        await client.query('COMMIT');
        return { success: true, newPoints };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    majUtilisationEtPoints,
};
