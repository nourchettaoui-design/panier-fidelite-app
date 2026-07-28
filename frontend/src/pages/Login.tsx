// frontend/src/pages/Login.tsx
import React from 'react';
import { Link, useLocation, useNavigate} from 'react-router-dom';
import api from '../api/client';
import './Login.css';
import './AdminPage.css';
import logo from '../assets/g20.png';


export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = React.useState('');
    const [motDePasse, setMotDePasse] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [formError, setFormError] = React.useState<string | null>(null);
    const [infoMessage, setInfoMessage] = React.useState<string | null>(null);

    // lock inputs briefly to avoid browser autofill race
    const [inputsLocked, setInputsLocked] = React.useState(true);

    React.useEffect(() => {
        // consume session flash (session-expiry)
        const msg = sessionStorage.getItem('authMessage');
        if (msg) {
            setInfoMessage(msg);
            sessionStorage.removeItem('authMessage');
            setEmail('');
            setMotDePasse('');
        }

        // clear fields if navigated after logout (client passes state.clearPassword)
        const navState = (location.state as any) || {};
        if (navState.clearPassword) {
            setEmail('');
            setMotDePasse('');
            navigate(location.pathname, { replace: true, state: {} });
        }

        // ensure controlled inputs are empty at mount (avoid stale state)
        setEmail('');
        setMotDePasse('');

        // unlock inputs after a short delay to avoid browser autofill race
        const t = window.setTimeout(() => setInputsLocked(false), 300); // 300ms is robust
        return () => window.clearTimeout(t);
    }, [location, navigate]);

    function validateEmail(e: string) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(e);
    }

    async function handleSubmit(ev: React.FormEvent) {
        ev.preventDefault();
        setFormError(null);
        setInfoMessage(null);

        const emailTrimmed = (email || '').toLowerCase().trim();
        if (!emailTrimmed) {
            setFormError('L\'email est requis.');
            return;
        }
        if (!validateEmail(emailTrimmed)) {
            setFormError('Adresse email invalide.');
            return;
        }
        if (!motDePasse || motDePasse.length < 8) {
            setFormError('Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }

        setLoading(true);
        try {
            const data = await api.login(emailTrimmed, motDePasse);
            const utilisateur = data.utilisateur;
            const panier = data.panier || null;

            try {
                localStorage.setItem('utilisateur', JSON.stringify(utilisateur));
                if (panier) localStorage.setItem('panier', JSON.stringify(panier));
                else localStorage.removeItem('panier');
            } catch (e) {
                console.warn('Impossible de sauvegarder en localStorage:', e);
            }

            if (utilisateur && utilisateur.role === 'administrateur') {
                navigate(`/admin/${utilisateur.id}/paniers`);
            } else {
                if (panier && panier.actif === true) {
                    navigate(`/client/${utilisateur.id}/panier`);
                } else {
                    setFormError("Vous n'avez pas de panier actif. Veuillez demander une carte en magasin puis revenir.");
                }
            }
        } catch (err: any) {
            if (err?.status === 401) {
                setFormError('Email ou mot de passe incorrect.');
            } else if (err?.status === 403) {
                const msg = err?.data?.message || 'Accès refusé.';
                setFormError(msg);
            } else {
                setFormError(err?.data?.message || err?.message || 'Erreur de connexion. Réessayez plus tard.');
            }
        } finally {
            setLoading(false);
            setMotDePasse('');
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <img src={logo} alt="NourMarket" className="login-logo" />
                <h1 className="login-title">Portail Panier Fidélité</h1>

                {infoMessage && <div className="small">{infoMessage}</div>}
                {formError && <div className="error" role="alert">{formError}</div>}

                <form className="login-form" onSubmit={handleSubmit} noValidate autoComplete="off">
                    {/*
                       Hidden dummy inputs placed first to absorb browser autofill.
                       They are visually hidden but present in the DOM so the browser will
                       often fill them instead of the visible controlled inputs.
                    */}
                    <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden>
                        <input type="text" name="prevent_autofill_username" autoComplete="username" tabIndex={-1} />
                        <input type="password" name="prevent_autofill_password" autoComplete="current-password" tabIndex={-1} />
                    </div>

                    <label htmlFor="email">Adresse email</label>
                    <input
                        id="email"
                        name="email"               // keep explicit name, different from dummy
                        autoComplete="off"         // off for the visible input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ex: prenom.nom@example.com"
                        required
                        readOnly={inputsLocked}
                    />

                    <label htmlFor="motDePasse">Mot de passe</label>
                    <div className="input-with-toggle">
                        <input
                            id="motDePasse"
                            name="motDePasse"
                            autoComplete="new-password" // help prevent autofill for visible field
                            type={showPassword ? 'text' : 'password'}
                            value={motDePasse}
                            onChange={(e) => setMotDePasse(e.target.value)}
                            placeholder="Votre mot de passe"
                            required
                            readOnly={inputsLocked}
                        />
                        <button
                            type="button"
                            className="show-password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                            {showPassword ? 'Masquer' : 'Afficher'}
                        </button>
                    </div>

                    <button className="login-submit button-primary" type="submit" disabled={loading}>
                        {loading ? 'Connexion...' : 'Se connecter'}
                    </button>

                    <div className="form-links">
                        <Link to="/forgot-password" className="forgot-link">Mot de passe oublié ?</Link>
                        <span className="separator">|</span>
                        <span className="signup-prompt">
                            Vous n'avez pas de compte ?{' '}
                            <Link to="/signup" className="signup-link">Inscription</Link>
                        </span>
                    </div>
                </form>
            </div>
        </div>
    );
}
