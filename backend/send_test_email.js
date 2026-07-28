const { envoyerEmailCreds } = require('./helpers/mail');

(async () => {
    const res = await envoyerEmailCreds('your-test-recipient@example.com', 'Test', 'Utilisateur', 'Mymarket111$', { loginUrl: 'http://localhost:4173' });
    console.log('résultat envoi:', res);
})();
