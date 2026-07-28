/**
 * Script idempotent pour créer les indexes recommandés.
 *
 * Usage:
 *  cd backend
 *  node creer_indexes.js
 *
 * Optionnel:
 *  USE_CONCURRENT_INDEXES=true node creer_indexes.js
 *  -> tentera CREATE INDEX CONCURRENTLY pour éviter verrous longs sur tables chargées.
 *
 * Remarques:
 * - Ce script suppose que les tables existent (utilisateurs, paniers_fidelite).
 * - Il utilise pool de db.js (donc l'utilisateur DB configuré dans backend/.env sera utilisé).
 * - Pour créer un index vous devez être propriétaire de la table ou avoir les droits nécessaires.
 */

const pool = require('./db');

const useConcurrently = (process.env.USE_CONCURRENT_INDEXES || 'false').toLowerCase() === 'true';

function maybeConcurrently(sql) {
    if (!useConcurrently) return sql;
    // Si la déclaration est CREATE INDEX IF NOT EXISTS ... on ajoute CONCURRENTLY juste après CREATE INDEX.
    // Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
    return sql.replace(/^CREATE INDEX/i, 'CREATE INDEX CONCURRENTLY');
}

const stmts = [
    // index partiel optimisé pour: WHERE actif = true ORDER BY last_utilisation DESC
    `CREATE INDEX IF NOT EXISTS idx_paniers_actifs_last_utilisation
   ON paniers_fidelite (last_utilisation DESC)
   WHERE actif = true`,

    // index sur numero_carte pour lookup rapide
    `CREATE INDEX IF NOT EXISTS idx_paniers_numero_carte
   ON paniers_fidelite (numero_carte)`,

    // index insensible à la casse pour email
    `CREATE INDEX IF NOT EXISTS idx_utilisateurs_email_lower
   ON utilisateurs (lower(email))`,

    // exemple d'index couvrant (INCLUDE) — PostgreSQL 11+
    // Cet index aide si la requête lit numero_carte/points avec last_utilisation; éviter des heap fetchs.
    `CREATE INDEX IF NOT EXISTS idx_paniers_actifs_last_utilisation_covering
   ON paniers_fidelite (last_utilisation DESC)
   INCLUDE (numero_carte, points)
   WHERE actif = true`
];

(async function run() {
    console.log('Début création des indexes — useConcurrently =', useConcurrently);
    try {
        for (const s of stmts) {
            const sql = maybeConcurrently(s);
            try {
                console.log('Exécution:', sql.split('\n')[0].trim(), '...');
                // IMPORTANT: If you run with CONCURRENTLY and get "cannot run inside a transaction block",
                // it means node-postgres wrapped it in a transaction — unlikely here but handle error gracefully.
                await pool.query(sql);
                console.log('OK');
            } catch (err) {
                // Si CONCURRENTLY provoque une erreur, on réessaie sans CONCURRENTLY (sécurité).
                if (useConcurrently && /cannot run.*transaction block/i.test(err.message)) {
                    console.warn('CONCURRENTLY impossible ici — réessai sans CONCURRENTLY pour cette index.');
                    const fallbackSql = s; // without CONCURRENTLY
                    await pool.query(fallbackSql);
                    console.log('OK (fallback without CONCURRENTLY)');
                } else {
                    // log error but continue with next index
                    console.error('Erreur lors de la création de l\'index:', err.message);
                }
            }
        }

        console.log('Terminé. Liste des index actuellement définis pour la table paniers_fidelite et utilisateurs :');
        const res = await pool.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('paniers_fidelite', 'utilisateurs')
      ORDER BY tablename, indexname
    `);
        console.table(res.rows);
    } catch (err) {
        console.error('Erreur fatale dans creer_indexes:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
})();
