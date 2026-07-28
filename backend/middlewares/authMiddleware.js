'use strict';

/**
 * Middleware principal : lit la session et expose req.utilisateur pour les routes.
 */
function authMiddleware(req, res, next) {
    try {
        if (req.session && req.session.utilisateur) {
            req.utilisateur = {
                id: req.session.utilisateur.id,
                email: req.session.utilisateur.email,
                nom: req.session.utilisateur.nom,
                prenom: req.session.utilisateur.prenom,
                role: req.session.utilisateur.role
            };
        } else {
            req.utilisateur = null;
        }
        return next();
    } catch (err) {
        console.error('authMiddleware error:', err);
        req.utilisateur = null;
        return next();
    }
}

/**
 * verifierConnexion : middleware pour exiger qu'un utilisateur soit connecté.
 */
function verifierConnexion(req, res, next) {
    try {
        if (req.session && req.session.utilisateur) return next();
        return res.status(401).json({ message: 'Session expirée ou non authentifié.' });
    } catch (err) {
        console.error('verifierConnexion error:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
    }
}

/**
 * verifierAdministrateur : middleware pour exiger le rôle administrateur.
 */
function verifierAdministrateur(req, res, next) {
    try {
        const u = req.session && req.session.utilisateur;
        if (u && u.role === 'administrateur') return next();
        if (u) return res.status(403).json({ message: 'Accès refusé : rôle administrateur requis.' });
        return res.status(401).json({ message: 'Session expirée ou non authentifié.' });
    } catch (err) {
        console.error('verifierAdministrateur error:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
    }
}

module.exports = authMiddleware;
module.exports.verifierConnexion = verifierConnexion;
module.exports.verifierAdministrateur = verifierAdministrateur;
