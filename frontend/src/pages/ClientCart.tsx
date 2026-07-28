import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ClientCart.css';
import logo from '../assets/g20.png';
import api from '../api/client';

type Utilisateur = {
    id?: number;
    nom?: string;
    prenom?: string;
    email?: string;
    role?: 'utilisateur' | 'administrateur' | string;
};

type Panier = {
    id?: number;
    utilisateur_id?: number;
    numero_carte?: string | null;
    date_ouverture?: string | null;
    date_expiration?: string | null;
    points?: number | null;
    last_utilisation?: string | null;
    actif?: boolean | null;
    supprime?: boolean | null;
};

function parseDateSafe(s?: string | null): Date | null {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}
function addOneYear(d: Date): Date {
    const r = new Date(d);
    r.setFullYear(r.getFullYear() + 1);
    return r;
}
function formatDate(dateStr?: string | null): string {
    if (dateStr === null) return 'Jamais utilisé';
    if (!dateStr) return '—';
    const d = parseDateSafe(dateStr);
    if (!d) return '—';
    return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
}
function computeExpirationDate(panier: Panier | null): Date | null {
    if (!panier) return null;
    if (panier.date_expiration) {
        const exp = parseDateSafe(panier.date_expiration);
        if (exp) return exp;
    }
    if (panier.last_utilisation) {
        const last = parseDateSafe(panier.last_utilisation);
        if (last) return addOneYear(last);
    }
    return null;
}
function isPanierActif(panier: Panier | null): boolean {
    if (!panier) return false;
    if (panier.supprime === true) return false;
    if (panier.actif === false) return false;
    const now = new Date();
    const exp = computeExpirationDate(panier);
    if (exp) return exp >= now;
    return panier.actif === true;
}

export default function ClientCart(): React.ReactElement {
    const navigate = useNavigate();
    const [utilisateur, setUtilisateur] = React.useState<Utilisateur | null>(null);
    const [panier, setPanier] = React.useState<Panier | null>(null);
    const [loading, setLoading] = React.useState<boolean>(true);
    const mountedRef = React.useRef(true);

    React.useEffect(() => {
        mountedRef.current = true;
        // hydrate UI immediately
        try {
            const rawUser = localStorage.getItem('utilisateur');
            const rawPanier = localStorage.getItem('panier');
            if (rawUser) setUtilisateur(JSON.parse(rawUser));
            if (rawPanier) setPanier(JSON.parse(rawPanier));
        } catch (e) {
            console.warn('ClientCart: could not parse localStorage', e);
        }

        const controller = new AbortController();

        (async () => {
            setLoading(true);
            try {
                // Get user from localStorage if available
                const rawUser = localStorage.getItem('utilisateur');
                let u: Utilisateur | null = rawUser ? JSON.parse(rawUser) : null;

                // If no local user, try server-side session recovery
                if (!u?.id) {
                    try {
                        const me = await api.getJson('/auth/me');
                        u = me?.utilisateur ?? me;
                        if (u && u.id) {
                            // persist minimal utilisateur for routing/other pages
                            try {
                                localStorage.setItem('utilisateur', JSON.stringify(u));
                            } catch (err) {
                                /* ignore storage errors */
                            }
                            if (mountedRef.current) setUtilisateur(u);
                        } else {
                            // server responded but no user — treat as unauthenticated
                            setLoading(false);
                            navigate('/login', { replace: true });
                            return;
                        }
                    } catch (err) {
                        // likely 401 or network error -> client handles 401 via handleAuthExpired (redirect)
                        setLoading(false);
                        return;
                    }
                }

                if (!u?.id) {
                    setLoading(false);
                    navigate('/login', { replace: true });
                    return;
                }

                // fetch panier using centralized client (credentials included)
                const data = await api.getJson(`/utilisateurs/${u.id}/panier`);
                const fetchedPanier = data?.panier ?? data;

                if (mountedRef.current) {
                    if (fetchedPanier) {
                        setPanier(fetchedPanier);
                        try {
                            localStorage.setItem('panier', JSON.stringify(fetchedPanier));
                            localStorage.setItem('utilisateur', JSON.stringify(u));
                        } catch (err) {
                            console.warn('ClientCart: could not write localStorage', err);
                        }
                    }
                    setLoading(false);
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    console.warn('ClientCart fetch error (silent):', err);
                    if (mountedRef.current) setLoading(false);
                }
            }
        })();

        return () => {
            mountedRef.current = false;
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    const actif = React.useMemo(() => isPanierActif(panier), [panier]);

    async function handleLogout() {
        // Best-effort: ask server to destroy session first, but always clear client state.
        try {
            // Call backend logout. api.postJson uses credentials: 'include', so cookie is sent.
            await api.postJson('/auth/logout', {});
        } catch (err) {
            // Network error or server returned non-2xx — continue with client-side cleanup anyway.
            console.warn('Logout request failed (continuing client-side cleanup):', err);
        }

        // Notify other tabs (storage event)
        try {
            localStorage.setItem('panier:loggedOutAt', String(Date.now()));
            localStorage.removeItem('utilisateur');
            localStorage.removeItem('panier');
        } catch (e) {
            console.warn('Could not update localStorage during logout:', e);
        }

        // Redirect to login and ask Login to clear password field via state
        navigate('/login', { state: { clearPassword: true } });
    }

    const expirationDateISO = React.useMemo(() => {
        const exp = computeExpirationDate(panier);
        return exp ? exp.toISOString() : null;
    }, [panier]);

    return (
        <div className="client-page client-page--white">
            <main className="client-content" role="main" aria-labelledby="panier-title" aria-busy={loading}>
                <section className="client-panel" aria-label="Détails du panier">
                    <div className="panel-grid-simple">
                        <div className="logo-col" aria-hidden>
                            <img src={logo} alt="NourMarket" className="client-logo" />
                        </div>
                        <div className="content-col">
                            <div className="content-grid">
                                <div className="title-block">
                                    <h1 id="panier-title" className="client-title">Mon panier fidélité</h1>
                                    <div className="client-subtitle">
                                        {utilisateur?.prenom || utilisateur?.nom
                                            ? `${utilisateur.prenom ?? ''} ${utilisateur.nom ?? ''}`.trim()
                                            : utilisateur?.email ?? ''}
                                    </div>
                                </div>

                                <div className="logout-anchor">
                                    <button
                                        type="button"
                                        className="panel-logout"
                                        onClick={handleLogout}
                                        aria-label="Se déconnecter"
                                        title="Se déconnecter"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                                            <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M21 12H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M13 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="data-grid">
                                <div className="data-item">
                                    <div className="card-label">Numéro de carte</div>
                                    <div className="card-value">{panier?.numero_carte ?? '—'}</div>
                                </div>

                                <div className="data-item data-item--points">
                                    <div className="card-label">Points</div>
                                    <div className="card-value">{panier?.points ?? 0}</div>
                                </div>

                                <div className="meta-row">
                                    <div className="meta-item">
                                        <div className="tiny-muted">Statut</div>
                                        <div className="meta-value">{actif ? 'Actif' : 'Désactivé'}</div>
                                    </div>

                                    <div className="meta-item">
                                        <div className="tiny-muted">Expiration</div>
                                        <div className="meta-value">{formatDate(expirationDateISO)}</div>
                                    </div>

                                    <div className="meta-item">
                                        <div className="tiny-muted">Dernière utilisation</div>
                                        <div className="meta-value">{formatDate(panier?.last_utilisation)}</div>
                                    </div>
                                </div>

                                <div className="actions-wrapper">
                                    <button
                                        type="button"
                                        className="button-primary actions-btn"
                                        onClick={() => navigate(`/client/${utilisateur?.id ?? ''}/transactions`)}
                                        disabled={loading}
                                        aria-disabled={loading}
                                    >
                                        Voir les transactions
                                    </button>

                                    <button
                                        type="button"
                                        className="button-primary actions-btn"
                                        onClick={() => navigate(`/client/${utilisateur?.id ?? ''}/reclamation`)}
                                        disabled={loading}
                                        aria-disabled={loading}
                                    >
                                        Utiliser mes points
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {loading && (
                        <div className="panel-loading" aria-live="polite" style={{ marginTop: 12 }}>
                            Chargement…
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
