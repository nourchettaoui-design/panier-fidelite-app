// backend/routes/auth.js
// Routes d'authentification (login / logout / me)
// Code en français (messages), responses JSON minimalistes et sécurisées.

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { hasActiveCart } = require('../helpers/auth'); // suppose existe

const router = express.Router();

/**
 * POST /auth/login
 * Body: { email, mot_de_passe }
 * Roles: 'administrateur' or 'utilisateur'
 *
 * Behavior:
 * - Verify email/password (bcrypt)
 * - If role === 'administrateur' -> allow login (no cart check)
 * - If role === 'utilisateur' -> require an active cart (hasActiveCart)
 * - On success: set req.session.utilisateur (id, email, nom, prenom, role)
 * - Returns: { utilisateur, panier? }
 */
router.post('/login', async (req, res) => {
    try {
        const { email, mot_de_passe } = req.body || {};
        const emailNormalized = String(email || '').toLowerCase().trim();
        const passwordProvided = String(mot_de_passe || '');

        // Validations basiques
        if (!emailNormalized) return res.status(400).json({ message: 'email manquant' });
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(emailNormalized)) return res.status(400).json({ message: 'email incorrect' });

        if (!passwordProvided || passwordProvided.length < 8) {
            return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères.' });
        }

        // Récupérer utilisateur par email
        const qUser = `
      SELECT id, nom, prenom, email, telephone, adresse, role, mot_de_passe
      FROM utilisateurs
      WHERE email = $1
      LIMIT 1
    `;
        const rUser = await pool.query(qUser, [emailNormalized]);
        if (rUser.rowCount === 0) {
            return res.status(401).json({ message: 'email ou mot de passe incorrect' });
        }

        const user = rUser.rows[0];

        if (!user.mot_de_passe) {
            return res.status(403).json({ message: 'Aucun mot de passe défini pour ce compte.' });
        }

        // Vérifier le mot de passe (bcrypt)
        const ok = await bcrypt.compare(passwordProvided, user.mot_de_passe);
        if (!ok) {
            return res.status(401).json({ message: 'email ou mot de passe incorrect' });
        }

        // Normaliser et valider le rôle
        const role = (user.role || '').toLowerCase();
        if (role !== 'administrateur' && role !== 'utilisateur') {
            user.role = 'utilisateur';
        } else {
            user.role = role;
        }

        // Préparer objet utilisateur renvoyé (sans mot_de_passe)
        const utilisateur = {
            id: user.id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            telephone: user.telephone,
            adresse: user.adresse,
            role: user.role
        };

        if (req.session && typeof req.session.regenerate === 'function') {
            req.session.regenerate((err) => {
                if (err) {
                    console.error('session.regenerate error', err);
                    // fallback: set directly
                    req.session.utilisateur = { id: utilisateur.id, email: utilisateur.email, nom: utilisateur.nom, prenom: utilisateur.prenom, role: utilisateur.role };
                    // continue to respond...
                } else {
                    req.session.utilisateur = { id: utilisateur.id, email: utilisateur.email, nom: utilisateur.nom, prenom: utilisateur.prenom, role: utilisateur.role };
                }
                // send response (utilisateur, panier)
                // NOTE: move your res.json({ utilisateur, panier }) call here
            });
        } else {
            // fallback if no session API
            req.session.utilisateur = { id: utilisateur.id, email: utilisateur.email, nom: utilisateur.nom, prenom: utilisateur.prenom, role: utilisateur.role };
            // send response
        }

        // Stocker la session (express-session doit être configuré dans index.js)
        if (req.session) {
            req.session.utilisateur = {
                id: utilisateur.id,
                email: utilisateur.email,
                nom: utilisateur.nom,
                prenom: utilisateur.prenom,
                role: utilisateur.role
            };
        }

        // If administrator, return immediately (no cart check)
        if (user.role === 'administrateur') {
            return res.json({ utilisateur });
        }

        // For 'utilisateur', ensure they have an active cart
        const active = await hasActiveCart(user.id);
        if (!active) {
            // Do not destroy the session — but inform client that no active cart exists
            return res.status(403).json({
                message: "Vous n'avez pas de panier actif. Veuillez demander une carte fidélité en magasin."
            });
        }

        // Optionally return the active panier details (latest)
        const qPanier = `
      SELECT id, date_ouverture, date_expiration, points, numero_carte, last_utilisation, actif
      FROM paniers_fidelite
      WHERE utilisateur_id = $1
        AND actif = true
        AND (supprime = false OR supprime IS NULL)
      ORDER BY date_ouverture DESC
      LIMIT 1
    `;
        const rPanier = await pool.query(qPanier, [user.id]);
        const panier = rPanier.rowCount > 0 ? rPanier.rows[0] : null;

        return res.json({ utilisateur, panier });
    } catch (err) {
        console.error('POST /auth/login error:', err);
        return res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
});

/**
 * POST /auth/logout
 * Destroy session and clear cookie
 */
router.post('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Erreur lors de la destruction de session:', err);
                return res.status(500).json({ message: 'Erreur lors de la déconnexion.' });
            }
            // clear cookie (le nom doit correspondre à celui configuré dans index.js)
            res.clearCookie('panier.sid');
            return res.json({ message: 'Déconnecté.' });
        });
    } else {
        return res.json({ message: 'Déconnecté (aucune session).' });
    }
});

/**
 * GET /auth/me
 * Retourne l'utilisateur connecté (si session valide), sinon 401
 */
router.get('/me', (req, res) => {
    try {
        if (req.session && req.session.utilisateur) {
            // renvoyer l'objet utilisateur stocké en session (déjà minimal)
            return res.json({ utilisateur: req.session.utilisateur });
        }
        return res.status(401).json({ message: 'Non authentifié.' });
    } catch (err) {
        console.error('GET /auth/me error:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
    }
});

/**
 * POST /auth/signup
 * - Body: { email, mot_de_passe }
 *
 * Behavior:
 * - Validate email & password format.
 * - Find user by lower(email). If none → respond 404/403 with "no active cart" style message.
 * - If found and role === 'administrateur' -> 403: ask to reset password instead.
 * - If found and mot_de_passe exists:
 *     - if user has active cart -> 409: account exists, try reset password.
 *     - else -> 403: no active cart (or other message).
 * - If found and mot_de_passe is empty/null AND hasActiveCart(user.id) === true:
 *     - hash the password and update utilisateurs.mot_de_passe -> respond 200 { message }.
 */
router.post('/signup', async (req, res) => {
    try {
        const { email: rawEmail, mot_de_passe } = req.body || {};
        const email = String(rawEmail || '').toLowerCase().trim();
        const pwd = String(mot_de_passe || '');

        // Basic validation
        if (!email) return res.status(400).json({ message: 'Email manquant.' });
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(email)) return res.status(400).json({ message: 'Adresse email invalide.' });

        if (!pwd || pwd.length < 8) {
            return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères.' });
        }
        const pwdRe = /(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}/;
        if (!pwdRe.test(pwd)) {
            return res.status(400).json({
                message: 'Mot de passe invalide : min 8 caractères, 1 majuscule, 1 chiffre et 1 caractère spécial.'
            });
        }

        // Find user by email
        const qUser = `SELECT id, role, mot_de_passe FROM utilisateurs WHERE lower(email) = $1 LIMIT 1`;
        const rUser = await pool.query(qUser, [email]);

        // If no user record -> tell user no active cart (UX choice consistent with login flow)
        if (rUser.rowCount === 0) {
            return res.status(403).json({
                message: "Aucun panier actif trouvé pour cet email. Veuillez demander une carte fidélité en magasin."
            });
        }

        const user = rUser.rows[0];
        const role = String(user.role || '').toLowerCase();

        // If admin account exists -> ask to reset password instead
        if (role === 'administrateur') {
            return res.status(403).json({
                message: 'Un compte administrateur existe déjà pour cet email. Veuillez réinitialiser votre mot de passe.'
            });
        }

        // Check active cart status
        const active = await hasActiveCart(user.id);
        if (!active) {
            return res.status(403).json({
                message: "Aucun panier actif trouvé pour cet email. Veuillez demander une carte fidélité en magasin."
            });
        }

        // If password already present => account exists
        if (user.mot_de_passe) {
            return res.status(409).json({
                message: "Un compte existe déjà pour cet email. Si vous avez oublié votre mot de passe, utilisez la réinitialisation."
            });
        }

        // No password and has active cart: create account (hash password)
        const hashed = await bcrypt.hash(pwd, 10);
        await pool.query('UPDATE utilisateurs SET mot_de_passe = $1 WHERE id = $2', [hashed, user.id]);

        // Optionally log creation
        console.log(`Signup: password set for utilisateur id=${user.id}, email=${email}`);

        return res.json({ message: 'Compte créé : vous pouvez maintenant vous connecter.' });
    } catch (err) {
        console.error('POST /auth/signup error:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
    }
});

module.exports = router;
