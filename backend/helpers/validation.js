const EMPTY_STRING = '';

const validateEmail = (email) => {
    if (!email || email.trim() === EMPTY_STRING) {
        return 'email manquant';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return 'email incorrect';
    }
    return null;
};

const validatePassword = (password) => {
    if (!password || password.trim() === EMPTY_STRING) {
        return 'mot de passe manquant';
    }
    if (password.length < 6) {
        return 'mot de passe incorrect';
    }
    return null;
};

module.exports = { validateEmail, validatePassword };
