// frontend/src/pages/Signup.tsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import './Login.css';
import logo from '../assets/g20.png';

export default function Signup() {
    const navigate = useNavigate();
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirm, setConfirm] = React.useState('');
    const [show, setShow] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [info, setInfo] = React.useState<string | null>(null);

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
            const data = await api.postJson('/auth/signup', { email: eTrim, mot_de_passe: password });
            setInfo(data?.message || 'Compte créé. Vous pouvez vous connecter.');
            setTimeout(() => navigate('/login'), 1500);
        } catch (err: any) {
            // Map status codes to useful messages
            if (err?.status === 409) {
                setError(err?.data?.message || 'Un compte existe déjà. Essayez la réinitialisation du mot de passe.');
            } else if (err?.status === 403) {
                setError(err?.data?.message || 'Aucun panier actif trouvé pour cet email.');
            } else if (err?.status === 400) {
                setError(err?.data?.message || 'Données invalides.');
            } else {
                setError(err?.data?.message || err?.message || 'Erreur serveur.');
            }
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
                <h1 className="login-title">Inscription</h1>

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

                    <label htmlFor="password">Mot de passe</label>
                    <div className="input-with-toggle">
                        <input
                            id="password"
                            name="password"
                            type={show ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Votre mot de passe"
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

                    <label htmlFor="confirm">Confirmer le mot de passe</label>
                    <input
                        id="confirm"
                        name="confirm"
                        type={show ? 'text' : 'password'}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Confirmer le mot de passe"
                        required
                        autoComplete="new-password"
                    />

                    <button className="login-submit button-primary" type="submit" disabled={loading}>
                        {loading ? 'Création...' : 'Créer un compte'}
                    </button>
                </form>

                <div className="form-links" style={{ marginTop: 12 }}>
                    <Link to="/login" className="forgot-link">Retour à la connexion</Link>
                    <span className="separator">|</span>
                    <span className="signup-prompt">
            Vous avez déjà un compte ?{' '}
                        <Link to="/login" className="signup-link">Se connecter</Link>
          </span>
                </div>
            </div>
        </div>
    );
}
