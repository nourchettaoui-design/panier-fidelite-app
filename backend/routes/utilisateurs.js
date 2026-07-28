// backend/routes/utilisateurs.js
// Routes liées aux utilisateurs (création par un gestionnaire, récupération du panier d'un utilisateur).
// Code en français / messages en français.
// - POST /utilisateurs/creer : création d'un utilisateur (doit être appelé par un administrateur connecté).
//    Body attendu (JSON): { nom, prenom, email, telephone, adresse, mot_de_passe? }
//    - si mot_de_passe est fourni et valide, il est hashé et stocké ; un email est envoyé (démo).
//    - si mot_de_passe absent => l'utilisateur est créé sans mot_de_passe (ne peut pas se connecter).
// - GET  /utilisateurs/:id/panier : retourne le PANIER ACTIF le plus récent du user (ou null).
//
// Prérequis:
// - `pool` exporté depuis ../db (pool.query)
// - helper d'email disponible ../helpers/mail.js exportant `envoyerEmailCreds(email, prenom, nom, motDePassePlain, options)`
// - bcryptjs installé

const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { envoyerEmailCreds } = require('../helpers/mail');

// --- Helpers de validation (français) ---
function emailValide(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

function motDePasseValide(pwd) {
    // Minimum 8 caractères, au moins 1 majuscule, 1 chiffre, 1 caractère spécial
    if (!pwd || typeof pwd !== 'string') return false;
    if (pwd.length < 8) return false;
    if (!/[A-Z]/.test(pwd)) return false;
    if (!/[0-9]/.test(pwd)) return false;
    if (!/[^A-Za-z0-9]/.test(pwd)) return false;
    return true;
}

// --- Middleware: récupération de l'utilisateur de session/auth (utilisé dans plusieurs routes) ---
function getSessionUser(req) {
    // prefer req.utilisateur (auth middleware), otherwise fallback to session
    return (req.utilisateur || (req.session && req.session.utilisateur)) || null;
}

// --- Route: récupérer le panier actif le plus récent d'un utilisateur ---
// GET /utilisateurs/:id/panier
router.get('/:id/panier', async (req, res) => {
    try {
        const idParam = req.params.id;
        const requestedId = Number(idParam);

        if (!Number.isInteger(requestedId) || requestedId <= 0) {
            return res.status(400).json({ message: 'Identifiant utilisateur invalide.' });
        }

        const sessUser = getSessionUser(req);
        if (!sessUser) {
            return res.status(401).json({ message: 'Non authentifié.' });
        }

        // Authorization: admins OR owner only
        if (sessUser.role !== 'administrateur' && sessUser.id !== requestedId) {
            return res.status(403).json({ message: 'Accès refusé.' });
        }

        // On privilégie le panier actif (actif = true). Si aucun actif, on retourne null.
        const qPanier = `
      SELECT id, utilisateur_id, numero_carte, date_ouverture, date_expiration,
             points, last_utilisation, actif, supprime
      FROM paniers_fidelite
      WHERE utilisateur_id = $1 AND actif = true AND supprime = false
      ORDER BY date_ouverture DESC NULLS LAST
      LIMIT 1
    `;
        const rPanier = await pool.query(qPanier, [requestedId]);
        const panier = rPanier.rowCount > 0 ? rPanier.rows[0] : null;

        return res.status(200).json({ panier });
    } catch (err) {
        console.error('GET /utilisateurs/:id/panier error:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// --- Route: création d'un utilisateur (par un administrateur) ---
// POST /utilisateurs/creer
// Body JSON: { nom, prenom, email, telephone, adresse, mot_de_passe? }
router.post('/creer', async (req, res) => {
    try {
        const sessUser = getSessionUser(req);
        if (!sessUser) {
            return res.status(401).json({ erreur: 'Non authentifié.' });
        }
        if (sessUser.role !== 'administrateur') {
            return res.status(403).json({ erreur: 'Seul un administrateur peut créer des utilisateurs.' });
        }

        const {
            nom = '',
            prenom = '',
            email = '',
            telephone = '',
            adresse = '',
            mot_de_passe // optional
        } = req.body || {};

        const emailNorm = (email || '').toLowerCase().trim();

        // Validations utiles
        if (!emailNorm || !emailValide(emailNorm)) {
            return res.status(400).json({ erreur: 'Adresse email invalide.' });
        }

        // si mot_de_passe fourni -> validate
        let hashedPwd = null;
        const willSendPasswordEmail = Boolean(mot_de_passe && mot_de_passe !== '');
        if (willSendPasswordEmail) {
            if (!motDePasseValide(mot_de_passe)) {
                return res.status(400).json({
                    erreur: 'Mot de passe invalide. Il doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.'
                });
            }
            // hash the password
            const saltRounds = 10;
            hashedPwd = await bcrypt.hash(mot_de_passe, saltRounds);
        }

        // Vérifier doublon par email
        const qCheck = 'SELECT id, role FROM utilisateurs WHERE email = $1 LIMIT 1';
        const rCheck = await pool.query(qCheck, [emailNorm]);
        if (rCheck.rows && rCheck.rows.length > 0) {
            return res.status(409).json({ erreur: 'Un utilisateur avec cet email existe déjà.' });
        }

        // Insérer l'utilisateur en base (role = 'utilisateur')
        const insertQ = `
      INSERT INTO utilisateurs (nom, prenom, email, telephone, adresse, role, mot_de_passe)
      VALUES ($1,$2,$3,$4,$5,'utilisateur',$6)
      RETURNING id, nom, prenom, email, telephone, adresse, role
    `;
        const insertParams = [nom, prenom, emailNorm, telephone, adresse, hashedPwd];
        const rIns = await pool.query(insertQ, insertParams);
        const newUser = rIns.rows[0];

        // Si mot_de_passe a été fourni et hashé -> envoi de l'email (démo)
        let mailInfo = { email_envoye: false };
        if (willSendPasswordEmail) {
            try {
                // envoyerEmailCreds: renvoie { ok: true, previewUrl? } ou { ok:false, erreur }
                const mailRes = await envoyerEmailCreds(emailNorm, prenom, nom, mot_de_passe, { loginUrl: process.env.FRONTEND_URL });
                mailInfo.email_envoye = !!mailRes.ok;
                if (mailRes.previewUrl) mailInfo.preview = mailRes.previewUrl;
                if (!mailRes.ok) mailInfo.email_erreur = mailRes.erreur;
            } catch (mailErr) {
                console.error('Erreur envoi email création utilisateur:', mailErr);
                mailInfo.email_envoye = false;
                mailInfo.email_erreur = String(mailErr.message || mailErr);
            }
        }

        // Réponse : on ne renvoie jamais le mot de passe en clair
        const payload = { utilisateur: newUser, email_envoye: mailInfo.email_envoye };
        if (mailInfo.preview) payload.preview = mailInfo.preview;
        if (mailInfo.email_erreur) payload.email_erreur = mailInfo.email_erreur;

        return res.status(201).json(payload);
    } catch (err) {
        console.error('POST /utilisateurs/creer error:', err);
        // gestion d'erreur contrainte unique
        if (err && err.code === '23505') {
            return res.status(409).json({ erreur: 'Email déjà utilisé.' });
        }
        return res.status(500).json({ erreur: 'Erreur serveur lors de la création de l\'utilisateur.' });
    }
});

// --- Optionnel: endpoint pour vérifier si un email a un panier actif (utile pour signup) ---
// GET /utilisateurs/email/:email/has-active-panier
router.get('/email/:email/has-active-panier', async (req, res) => {
    try {
        const rawEmail = req.params.email || '';
        const emailNorm = rawEmail.toLowerCase().trim();
        if (!emailValide(emailNorm)) {
            return res.status(400).json({ erreur: 'Adresse email invalide.' });
        }

        // Cherche l'utilisateur
        const qUser = 'SELECT id FROM utilisateurs WHERE email=$1 LIMIT 1';
        const rUser = await pool.query(qUser, [emailNorm]);
        if (!rUser.rows || rUser.rows.length === 0) {
            return res.json({ has_active_panier: false, utilisateur_id: null });
        }
        const userId = rUser.rows[0].id;

        const qPan = `SELECT 1 FROM paniers_fidelite WHERE utilisateur_id=$1 AND actif=true AND supprime=false LIMIT 1`;
        const rPan = await pool.query(qPan, [userId]);
        const hasActive = rPan.rowCount > 0;

        return res.json({ has_active_panier: hasActive, utilisateur_id: userId });
    } catch (err) {
        console.error('GET /utilisateurs/email/:email/has-active-panier error:', err);
        return res.status(500).json({ erreur: 'Erreur serveur.' });
    }
});

module.exports = router;
