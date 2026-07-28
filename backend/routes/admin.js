// Routes pour les administrateurs (and owner access) — mounted at /admin (index.js)

const express = require('express');
const router = express.Router();
const pool = require('../db'); // utilisez le pool déjà présent dans votre projet
const bcrypt = require('bcryptjs');
// add with other requires
const { envoyerEmailCreds } = require('../helpers/mail');

// If you already export verifierAdministrateur from middleware, you can import it.
// For compatibility this file still provides a fallback local verifierAdministrateur if needed:
let externalVerifier = null;
try {
    // Try to import centralized middleware (if present)
    const mw = require('../middlewares/authMiddleware');
    if (mw && typeof mw.verifierAdministrateur === 'function') {
        externalVerifier = mw.verifierAdministrateur;
    }
} catch (e) {
    // ignore — we'll use local verifier below if needed
}

// Local verifierAdministrateur (keeps previous behavior if middleware not used)
function localVerifierAdministrateur(req, res, next) {
    const usr = req.utilisateur;
    if (!usr || usr.role !== 'administrateur') {
        return res.status(403).json({ erreur: 'Accès refusé : rôle administrateur requis.' });
    }
    next();
}
const verifierAdministrateur = externalVerifier || localVerifierAdministrateur;

/**
 * CHAMPS_SORT: safe mapping used for ORDER BY (do not interpolate untrusted input)
 */
const CHAMPS_SORT = {
    'last_utilisation': 'p.last_utilisation',
    'date_ouverture': 'p.date_ouverture',
    'date_expiration': 'p.date_expiration',
    'points': 'p.points',
    'nom': 'u.nom',
    'prenom': 'u.prenom',
    'numero_carte': 'p.numero_carte',
    'email': 'u.email'
};

/**
 * Helper: owner-or-admin check.
 * - requester must be authenticated (req.utilisateur set by global auth middleware)
 * - allow if requester.role === 'administrateur' OR requester.id === managerId
 */
function ensureOwnerOrAdmin(req, res) {
    const requester = req.utilisateur;
    if (!requester) {
        res.status(401).json({ message: 'Non authentifié.' });
        return null;
    }
    const managerIdRaw = String(req.params.managerId || '').trim();
    const managerId = Number(managerIdRaw);
    if (!Number.isFinite(managerId) || managerId <= 0) {
        res.status(400).json({ message: 'Identifiant manager invalide.' });
        return null;
    }
    const isAdmin = String(requester.role || '').toLowerCase() === 'administrateur';
    if (!isAdmin && Number(requester.id) !== managerId) {
        res.status(403).json({ message: 'Accès refusé.' });
        return null;
    }
    return { requester, managerId, isAdmin };
}

/**
 * GET /admin/:managerId/paniers
 *
 * If requester is admin -> behave like previous /admin/paniers (list all matching active/inactive)
 * If requester is not admin (owner) -> allowed only when managerId === requester.id and results restricted to that utilisateur_id
 *
 * Query params:
 *   actif (true|false) default true
 *   page, pageSize, search, sortField, sortDir
 */
router.get('/:managerId/paniers', async (req, res) => {
    try {
        const ctx = ensureOwnerOrAdmin(req, res);
        if (!ctx) return; // ensureOwnerOrAdmin already responded with status
        const { isAdmin, managerId } = ctx;

        const actif = req.query.actif === 'false' ? false : true;
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '5'), 10)));
        const offset = (page - 1) * pageSize;
        const searchRaw = String(req.query.search || '').trim();
        const sortField = String(req.query.sortField || 'last_utilisation');
        const sortDir = (String(req.query.sortDir || 'desc').toLowerCase() === 'asc') ? 'ASC' : 'DESC';

        const sortCol = CHAMPS_SORT[sortField] || 'p.last_utilisation';
        const orderBy = `${sortCol} ${sortDir}`;

        const hasSearch = searchRaw.length > 0;
        const searchParam = hasSearch ? `%${searchRaw.toLowerCase()}%` : null;

        // Build WHERE clauses and params dynamically, keeping parameter indexes correct
        const whereClauses = [];
        const paramsBase = [];

        // p.actif condition as first parameter
        whereClauses.push('p.actif = $1');
        paramsBase.push(actif);

        let paramIndex = 1;

        if (hasSearch) {
            paramIndex++;
            whereClauses.push(`(
        lower(u.nom) LIKE $${paramIndex}::text
        OR lower(u.prenom) LIKE $${paramIndex}::text
        OR lower(u.email) LIKE $${paramIndex}::text
        OR p.numero_carte LIKE $${paramIndex}::text
      )`);
            paramsBase.push(searchParam);
        }

        // If requester is not admin, restrict to that manager's own user id
        if (!isAdmin) {
            paramIndex++;
            whereClauses.push(`p.utilisateur_id = $${paramIndex}::int`);
            paramsBase.push(managerId);
        }

        const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // COUNT
        const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM paniers_fidelite p
      JOIN utilisateurs u ON u.id = p.utilisateur_id
      ${whereSql}
    `;
        const countRes = await pool.query(countQuery, paramsBase);
        const total = (countRes.rows[0] && countRes.rows[0].total) ? countRes.rows[0].total : 0;

        // Prepare main params (copy base and append limit/offset)
        const mainParams = paramsBase.slice(); // shallow copy
        // append limit and offset as next placeholders
        const limitIndex = mainParams.length + 1;
        const offsetIndex = mainParams.length + 2;
        mainParams.push(pageSize);
        mainParams.push(offset);

        // Main query
        const mainQuery = `
      SELECT
        p.id AS panier_id,
        p.numero_carte,
        p.date_ouverture,
        p.date_expiration,
        p.last_utilisation,
        p.points,
        p.actif,
        u.id AS utilisateur_id,
        u.nom,
        u.prenom,
        u.email,
        u.telephone,
        u.adresse
      FROM paniers_fidelite p
      JOIN utilisateurs u ON u.id = p.utilisateur_id
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT $${limitIndex}::int OFFSET $${offsetIndex}::int
    `;

        const result = await pool.query(mainQuery, mainParams);

        return res.json({
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
            rows: result.rows
        });
    } catch (err) {
        console.error('Erreur /admin/:managerId/paniers:', err);
        return res.status(500).json({ erreur: 'Erreur serveur lors de la récupération des paniers.' });
    }
});

/**
 * GET /admin/:managerId/paniers/:id
 * Returns a single panier with its utilisateur. Owner-or-admin check applied.
 */
router.get('/:managerId/paniers/:id', async (req, res) => {
    try {
        const ctx = ensureOwnerOrAdmin(req, res);
        if (!ctx) return;
        const { isAdmin, managerId } = ctx;

        const panierId = Number(String(req.params.id || '').trim());
        if (!Number.isFinite(panierId) || panierId <= 0) {
            return res.status(400).json({ message: 'Identifiant panier invalide.' });
        }

        // Build query; if requester not admin ensure the panier belongs to managerId
        const q = `
      SELECT
        p.id AS panier_id,
        p.utilisateur_id,
        p.numero_carte,
        p.date_ouverture,
        p.date_expiration,
        p.last_utilisation,
        p.points,
        p.actif,
        p.supprime,
        u.id AS utilisateur_id,
        u.nom,
        u.prenom,
        u.email,
        u.telephone,
        u.adresse
      FROM paniers_fidelite p
      JOIN utilisateurs u ON u.id = p.utilisateur_id
      WHERE p.id = $1
      ${!isAdmin ? 'AND p.utilisateur_id = $2' : ''}
      LIMIT 1
    `;
        const params = [panierId];
        if (!isAdmin) params.push(managerId);

        const r = await pool.query(q, params);
        if (r.rowCount === 0) {
            return res.status(404).json({ message: 'Panier introuvable.' });
        }
        const row = r.rows[0];
        const panier = {
            id: row.panier_id,
            utilisateur_id: row.utilisateur_id,
            numero_carte: row.numero_carte,
            date_ouverture: row.date_ouverture,
            date_expiration: row.date_expiration,
            last_utilisation: row.last_utilisation,
            points: row.points,
            actif: row.actif,
            supprime: row.supprime
        };
        const utilisateur = {
            id: row.utilisateur_id,
            nom: row.nom,
            prenom: row.prenom,
            email: row.email,
            telephone: row.telephone,
            adresse: row.adresse
        };
        return res.json({ panier, utilisateur });
    } catch (err) {
        console.error('Erreur GET /admin/:managerId/paniers/:id:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
    }
});

/**
 * POST /admin/managers - create a new manager (admin). Only existing admins may call this.
 * Keep this admin-only route protected with verifierAdministrateur.
 */
router.post('/managers', verifierAdministrateur, async (req, res) => {
    try {
        const { nom, prenom, email, telephone, adresse, mot_de_passe, role } = req.body || {};
        if (!nom || !prenom || !email || !mot_de_passe) {
            return res.status(400).json({ message: 'nom, prenom, email et mot_de_passe sont requis.' });
        }
        const emailLower = String(email).trim().toLowerCase();

        // check unique email (only prevent if an administrateur already exists with this email)
        const find = await pool.query(
            'SELECT id FROM utilisateurs WHERE lower(email) = $1 AND role = $2 LIMIT 1',
            [emailLower, 'administrateur']
        );
        if (find.rows.length > 0) {
            return res.status(409).json({ message: 'Un utilisateur avec cet email existe déjà.' });
        }


        // hash password
        const hash = await bcrypt.hash(String(mot_de_passe), 10);

        const insertQ = `
      INSERT INTO utilisateurs (nom, prenom, email, telephone, adresse, mot_de_passe, role, date_creation)
      VALUES ($1,$2,$3,$4,$5,$6, $7, now())
      RETURNING id, nom, prenom, email, role
    `;
        const r = await pool.query(insertQ, [nom, prenom, emailLower, telephone || null, adresse || null, hash, role || 'administrateur']);
        // after const created = r.rows[0];
        const created = r.rows[0];

        // send email in background (do not block response)
        (async () => {
            try {
                // mot_de_passe is the plaintext sent in req.body (available in this handler)
                const mailRes = await envoyerEmailCreds(created.email, created.prenom || '', created.nom || '', mot_de_passe, { loginUrl: process.env.FRONTEND_URL });
                if (!mailRes || !mailRes.ok) {
                    console.error('admin/managers: email send failed for', created.email, mailRes);
                } else if (mailRes.previewUrl) {
                    console.info('admin/managers: email preview URL (Ethereal):', mailRes.previewUrl);
                } else {
                    console.info('admin/managers: email sent to', created.email);
                }
            } catch (err) {
                console.error('admin/managers: exception sending email for', created.email, err && (err.stack || err.message || err));
            }
        })();

        return res.json({ message: 'Gestionnaire créé.', utilisateur: created });


    } catch (err) {
        console.error('Erreur POST /admin/managers:', err);
        return res.status(500).json({ message: 'Erreur serveur lors de la création.' });
    }
});

module.exports = router;
