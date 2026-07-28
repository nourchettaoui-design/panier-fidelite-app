// backend/helpers/mail.js
// En français : utilitaire d'envoi d'e-mails.
// Utilise SMTP réel si SMTP_* dans .env, sinon Ethereal (dev) et affiche une preview URL.

const nodemailer = require('nodemailer');

async function createTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 0);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
        // Transporteur réel
        return { transporter: nodemailer.createTransport({
                host,
                port: port || 587,
                secure: port === 465,
                auth: { user, pass }
            }), isTestAccount: false };
    }

    // Fallback development : Ethereal
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
    });
    console.warn('SMTP non configuré — utilisation d\'Ethereal pour développement.');
    return { transporter, isTestAccount: true };
}

/**
 * envoyerEmailCreds(emailDest, prenom, nom, motDePassePlain, options)
 * - envoie un email contenant l'URL de connexion et (optionnellement) le mot de passe en clair pour démo
 * - options.loginUrl peut override FRONTEND_URL
 */
async function envoyerEmailCreds(emailDest, prenom = '', nom = '', motDePassePlain = '', options = {}) {
    const from = process.env.EMAIL_FROM || 'NourMarket <noreply@testg20.com>';
    const frontendUrl = process.env.FRONTEND_URL || options.loginUrl || 'http://localhost:4173';
    const loginUrl = `${frontendUrl.replace(/\/$/, '')}/login`;

    const { transporter, isTestAccount } = await createTransporter();

    const subject = 'Votre compte NourMarket - accès Panier Fidélité';
    const html = `
    <p>Bonjour ${prenom || ''} ${nom || ''},</p>

    <p>Votre compte "Panier fidélité" a été créé. Vous pouvez vous connecter ici :</p>
    <p><a href="${loginUrl}">${loginUrl}</a></p>

    <p>Vos identifiants :</p>
    <ul>
      <li><b>Adresse email :</b> ${emailDest}</li>
      ${motDePassePlain ? `<li><b>Mot de passe :</b> ${motDePassePlain}</li>` : ''}
    </ul>

    <p>Pour votre sécurité, changez votre mot de passe après la première connexion.</p>

    <p>Cordialement,<br/>L'équipe NourMarket</p>
  `;

    try {
        const info = await transporter.sendMail({
            from,
            to: emailDest,
            subject,
            html
        });

        if (isTestAccount) {
            // nodemailer provides a preview URL for Ethereal
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.info('Ethereal preview URL:', previewUrl);
            return { ok: true, previewUrl };
        }

        return { ok: true, messageId: info.messageId };
    } catch (err) {
        console.error('Erreur envoi email:', err);
        return { ok: false, erreur: err.message || String(err) };
    }
}

module.exports = { envoyerEmailCreds };
