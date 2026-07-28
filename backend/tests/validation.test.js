const { validateEmail, validatePassword } = require('../helpers/validation');

test('validateEmail', () => {
    expect(validateEmail('')).toBe('email manquant');
    expect(validateEmail('invalid-email')).toBe('email incorrect');
    expect(validateEmail('test@example.com')).toBe(null);
});

test('validatePassword', () => {
    expect(validatePassword('')).toBe('mot de passe manquant');
    expect(validatePassword('123')).toBe('mot de passe incorrect');
    expect(validatePassword('password123')).toBe(null);
});
