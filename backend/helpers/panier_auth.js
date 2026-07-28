const pool = require('../db');

/**
 * Trouve un panier par numero_carte (non supprimé).
 * Retourne { panierRow, utilisateurRow } or null if not found.
 */
async function findPanierByNumero(numeroCarte) {
    const q = `
    SELECT p.*, u.id AS utilisateur_id, u.email, u.nom, u.prenom, u.telephone, u.adresse
    FROM paniers_fidelite p
    JOIN utilisateurs u ON p.utilisateur_id = u.id
    WHERE p.numero_carte = $1
      AND p.supprime = false
    LIMIT 1
  `;
    const res = await pool.query(q, [numeroCarte]);
    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    // split into panier and utilisateur objects
    const panier = {
        id: row.id,
        utilisateur_id: row.utilisateur_id,
        date_ouverture: row.date_ouverture,
        date_expiration: row.date_expiration,
        points: row.points,
        actif: row.actif,
        numero_carte: row.numero_carte,
        last_utilisation: row.last_utilisation,
    };
    const utilisateur = {
        id: row.utilisateur_id,
        email: row.email,
        nom: row.nom,
        prenom: row.prenom,
        telephone: row.telephone,
        adresse: row.adresse,
    };
    return { panier, utilisateur };
}

module.exports = {
    findPanierByNumero,
};
