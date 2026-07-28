// frontend/src/pages/MotDePasseOublie.tsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import './Login.css';
import logo from '../assets/g20.png';

export default function MotDePasseOublie() {
    const navigate = useNavigate();
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirm, setConfirm] = React.useState('');
    const [show, setShow] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [info, setInfo] = React.useState<string | null>(null);

    React.useEffect(() => {
        // ensure fields are clean on mount
        setEmail('');
        setPassword('');
        setConfirm('');
        setError(null);
        setInfo(null);
    }, []);

    function validateEmail(e: string) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(e);
    }
    function validatePassword(p: string) {
        const re = /(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}/;
        return re.test(p);
    }

    async function handleSubmit(ev: React.FormEvent) {
        ev.preventDefault();
        setError(null);
        setInfo(null);

        const eTrim = (email || '').toLowerCase().trim();
        if (!validateEmail(eTrim)) { setError('Adresse email invalide.'); return; }
        if (!password || password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
        if (!validatePassword(password)) {
            setError('Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.');
            return;
        }
        if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }

        setLoading(true);
        try {
            await api.postJson('/auth/password-reset', { email: eTrim, new_password: password });
            setInfo('Mot de passe modifié. Vous pouvez maintenant vous connecter.');
            setTimeout(() => { navigate('/login'); }, 1800);
        } catch (err: any) {
            setError(err?.data?.message || err?.message || 'Erreur serveur.');
        } finally {
            setLoading(false);
            setPassword('');
            setConfirm('');
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <img src={logo} alt="NourMarket" className="login-logo" />
                <h1 className="login-title">Réinitialisation du mot de passe</h1>

                {info && <div className="small login-info">{info} <Link to="/login">Se connecter</Link></div>}
                {error && <div className="error" role="alert">{error}</div>}

                <form className="login-form" onSubmit={handleSubmit} noValidate autoComplete="off">
                    {/* Hidden dummy inputs to absorb autofill */}
                    <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden>
                        <input type="text" name="prevent_autofill_username" autoComplete="username" tabIndex={-1} />
                        <input type="password" name="prevent_autofill_password" autoComplete="current-password" tabIndex={-1} />
                    </div>

                    <label htmlFor="email">Adresse email</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="prenom.nom@example.com"
                        required
                        autoComplete="email"
                    />

                    <label htmlFor="newPassword">Nouveau mot de passe</label>
                    <div className="input-with-toggle">
                        <input
                            id="newPassword"
                            name="newPassword"
                            type={show ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Nouveau mot de passe"
                            required
                            autoComplete="new-password"
                        />
                        <button
                            type="button"
                            className="show-password-toggle"
                            onClick={() => setShow(!show)}
                            aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                            {show ? 'Masquer' : 'Afficher'}
                        </button>
                    </div>

                    <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={show ? 'text' : 'password'}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Confirmer le mot de passe"
                        required
                        autoComplete="new-password"
                    />

                    <button className="login-submit button-primary" type="submit" disabled={loading}>
                        {loading ? 'Patientez...' : 'Changer le mot de passe'}
                    </button>
                </form>

                <div className="form-links" style={{ marginTop: 12 }}>
                    <Link to="/login" className="forgot-link">Retour à la connexion</Link>
                    <span className="separator">|</span>
                    <span className="signup-prompt">
            Vous n'avez pas de compte ?{' '}
                        <Link to="/signup" className="signup-link">Inscription</Link>
          </span>
                </div>
            </div>
        </div>
    );
}
