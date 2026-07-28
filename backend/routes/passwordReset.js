// backend/routes/passwordReset.js
// Single-step "forgot password" -> change password (no tokens).
// POST /auth/password-reset
// Body: { email, new_password }
// Behavior:
//  - Validate email format
//  - Validate password strength (server-side)
//  - If user.role === 'utilisateur' require active cart
//  - If user exists and passes checks -> hash new password and update utilisateurs.mot_de_passe
//  - Send confirmation email (nodemailer if configured, otherwise log)
//  - Return JSON { message: 'Mot de passe mis à jour.' } on success

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const nodemailer = require('nodemailer');

const router = express.Router();

const FRONTEND_BASE = process.env.VITE_APP_URL || 'http://localhost:3001';

// SMTP config (optional - set these in backend/.env to send real emails)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = (process.env.SMTP_SECURE === 'true');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@example.com';

let transporter = null;
if (SMTP_HOST) {
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
    });
}

async function sendResetConfirmationEmail(toEmail) {
    const subject = 'Confirmation : votre mot de passe a été modifié';
    const loginUrl = `${FRONTEND_BASE}/login`;
    const text = `Bonjour,\n\nVotre mot de passe a bien été modifié. Si vous n'êtes pas l'auteur de ce changement, contactez le support immédiatement.\n\nSe connecter : ${loginUrl}\n\nCordialement,\nL'équipe`;
    const html = `<p>Bonjour,</p>
    <p>Votre mot de passe a bien été modifié. Si vous n'êtes pas l'auteur de ce changement, contactez le support immédiatement.</p>
    <p><a href="${loginUrl}">Se connecter</a></p>
    <p>Cordialement,<br/>L'équipe</p>`;

    if (transporter) {
        try {
            await transporter.sendMail({ from: SMTP_FROM, to: toEmail, subject, text, html });
            console.log(`Email de confirmation envoyé à ${toEmail}`);
        } catch (err) {
            console.error('Erreur envoi email de confirmation:', err);
            // don't fail the reset if email sending fails
        }
    } else {
        // dev fallback: log link/text
        console.log('=== Email de confirmation (dev) ===');
        console.log('To:', toEmail);
        console.log('Subject:', subject);
        console.log(text);
        console.log('===============================');
    }
}

function validateEmailFormat(e) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(e);
}

// Password policy: at least 8 chars, one uppercase, one digit, one special char
function validatePasswordStrength(p) {
    const pwdRe = /(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}/;
    return pwdRe.test(p);
}

router.post('/password-reset', async (req, res) => {
    try {
        const { email: rawEmail, new_password } = req.body || {};
        const email = String(rawEmail || '').toLowerCase().trim();

        // Basic validations
        if (!email || !validateEmailFormat(email)) {
            return res.status(400).json({ message: 'Adresse email invalide.' });
        }
        if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
            return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères.' });
        }
        if (!validatePasswordStrength(new_password)) {
            return res.status(400).json({
                message: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.'
            });
        }

        // Find user by email
        const qUser = `SELECT id, role, email FROM utilisateurs WHERE email = $1 LIMIT 1`;
        const rUser = await pool.query(qUser, [email]);

        if (rUser.rowCount === 0) {
            // UX choice: you asked to check email for admin; return not found for all
            return res.status(400).json({ message: 'Email introuvable.' });
        }

        const user = rUser.rows[0];
        const role = String(user.role || '').toLowerCase();

        // Business rule: if utilisateur (client) require active cart
        if (role === 'utilisateur') {
            const qCart = `SELECT 1 FROM paniers_fidelite WHERE utilisateur_id = $1 AND actif = true AND (supprime = false OR supprime IS NULL) LIMIT 1`;
            const rCart = await pool.query(qCart, [user.id]);
            if (rCart.rowCount === 0) {
                return res.status(403).json({ message: "Aucun panier actif trouvé pour cet email. Impossible de réinitialiser le mot de passe." });
            }
        }

        // All checks passed -> hash and save new password
        const hashed = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE utilisateurs SET mot_de_passe = $1 WHERE id = $2', [hashed, user.id]);

        // Send confirmation email (non-blocking)
        try {
            await sendResetConfirmationEmail(user.email);
        } catch (err) {
            console.error('Erreur lors de l\'envoi du mail de confirmation (non bloquant):', err);
        }

        // Successful response
        return res.json({ message: 'Mot de passe mis à jour. Vous pouvez maintenant vous connecter.' });
    } catch (err) {
        console.error('POST /auth/password-reset error:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
    }
});

module.exports = router;