// frontend/src/pages/AdminPage.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import PasswordInput from '../components/PasswordInput';
import api from '../api/client';
import './Login.css';
import './AdminPage.css';
import logo from '../assets/g20.png';

type PanierRow = {
    panier_id: number;
    numero_carte: string | null;
    date_ouverture: string | null;
    date_expiration: string | null;
    last_utilisation: string | null;
    points: number | null;
    actif: boolean;
    utilisateur_id: number;
    nom: string | null;
    prenom: string | null;
    email: string | null;
};

/* ---------- Helper utilities (moved outside component to avoid re-creation) ---------- */
function formatDate(dateStr?: string | null) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function validateEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function passwordStrength(p: string) {
    // simple score: length + variety (0..4)
    const score =
        (p.length >= 8 ? 1 : 0) +
        (/[A-Z]/.test(p) ? 1 : 0) +
        (/\d/.test(p) ? 1 : 0) +
        (/[^A-Za-z0-9]/.test(p) ? 1 : 0);
    return Math.max(0, Math.min(4, score));
}

/* ---------- AdminPage component ---------- */
export default function AdminPage(): React.ReactElement {
    // parse displayed utilisateur from localStorage (UI only)
    let rawUser: string | null = null;
    try {
        rawUser = typeof globalThis !== 'undefined' ? globalThis.localStorage.getItem('utilisateur') : null;
    } catch (e) {
        rawUser = null;
    }
    const utilisateur = rawUser ? JSON.parse(rawUser) : null;

    // derive managerId from URL path (robust: parse pathname)
    const location = useLocation();
    const managerIdParam = React.useMemo(() => {
        try {
            const m = location.pathname.match(/\/admin\/([^/]+)\/paniers/);
            if (m && m[1]) return decodeURIComponent(m[1]);
        } catch (e) {
            // ignore
        }
        // fallback to localStorage user id for display if present
        return utilisateur && utilisateur.id ? String(utilisateur.id) : '';
    }, [location.pathname, utilisateur]);

    const managerId = managerIdParam || '';

    // modal state
    const [showAddModal, setShowAddModal] = React.useState(false);
    const [adding, setAdding] = React.useState(false);
    const [addError, setAddError] = React.useState<string | null>(null);
    const [addSuccess, setAddSuccess] = React.useState<string | null>(null);

    // form
    const [mgrNom, setMgrNom] = React.useState('');
    const [mgrPrenom, setMgrPrenom] = React.useState('');
    const [mgrEmail, setMgrEmail] = React.useState('');
    const [mgrTelephone, setMgrTelephone] = React.useState('');
    const [mgrAdresse, setMgrAdresse] = React.useState('');
    const [mgrPassword, setMgrPassword] = React.useState('');

    // A key to force remount of the form when opening the modal (helps avoid autofill/stale DOM values)
    const [addFormKey, setAddFormKey] = React.useState(0);

    // search / pagination / tables
    const [search, setSearch] = React.useState('');
    const [sortField, setSortField] = React.useState('last_utilisation');
    const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
    const [pageSize, setPageSize] = React.useState(5);

    const [activeRows, setActiveRows] = React.useState<PanierRow[]>([]);
    const [inactiveRows, setInactiveRows] = React.useState<PanierRow[]>([]);
    const [activePage, setActivePage] = React.useState(1);
    const [inactivePage, setInactivePage] = React.useState(1);
    const [activeTotalPages, setActiveTotalPages] = React.useState(1);
    const [inactiveTotalPages, setInactiveTotalPages] = React.useState(1);
    const [activeLoading, setActiveLoading] = React.useState(false);
    const [inactiveLoading, setInactiveLoading] = React.useState(false);
    const [activeError, setActiveError] = React.useState<string | null>(null);
    const [inactiveError, setInactiveError] = React.useState<string | null>(null);

    // debounce search
    const searchRef = React.useRef<number | null>(null);
    React.useEffect(() => {
        if (searchRef.current) globalThis.clearTimeout(searchRef.current);
        searchRef.current = (globalThis as any).setTimeout(() => {
            refreshActive(1);
            refreshInactive(1);
        }, 300);
        return () => {
            if (searchRef.current) globalThis.clearTimeout(searchRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, sortField, sortDir, pageSize, managerId]);

    // If managerId is empty, show an error early (prevents requests to invalid paths)
    const [missingManagerIdError] = React.useState(() => {
        return !managerId ? 'Identifiant manager introuvable dans l\'URL et pas de session utilisateur.' : null;
    });

    async function fetchPaniers({ actif, page }: { actif: boolean; page: number }) {
        if (!managerId) throw new Error('managerId missing');
        const paramsQS = new URLSearchParams();
        paramsQS.set('actif', String(actif));
        paramsQS.set('page', String(page));
        paramsQS.set('pageSize', String(pageSize));
        paramsQS.set('search', search || '');
        paramsQS.set('sortField', sortField);
        paramsQS.set('sortDir', sortDir);
        return api.getJson(`/admin/${encodeURIComponent(managerId)}/paniers?${paramsQS.toString()}`);
    }

    async function refreshActive(p = 1) {
        setActiveLoading(true);
        setActiveError(null);
        try {
            const data = await fetchPaniers({ actif: true, page: p });
            setActiveRows(data.rows || []);
            setActivePage(data.page || p);
            setActiveTotalPages(data.totalPages || 1);
        } catch (err: any) {
            setActiveError(err?.data?.message || err?.message || 'Erreur récupération paniers actifs.');
        } finally {
            setActiveLoading(false);
        }
    }

    async function refreshInactive(p = 1) {
        setInactiveLoading(true);
        setInactiveError(null);
        try {
            const data = await fetchPaniers({ actif: false, page: p });
            setInactiveRows(data.rows || []);
            setInactivePage(data.page || p);
            setInactiveTotalPages(data.totalPages || 1);
        } catch (err: any) {
            setInactiveError(err?.data?.message || err?.message || 'Erreur récupération paniers inactifs.');
        } finally {
            setInactiveLoading(false);
        }
    }

    React.useEffect(() => {
        if (!managerId) return;
        refreshActive(1);
        refreshInactive(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [managerId]);

    function openAddModal() {
        // clear previous values and messages to ensure modal opens empty
        setMgrNom('');
        setMgrPrenom('');
        setMgrEmail('');
        setMgrTelephone('');
        setMgrAdresse('');
        setMgrPassword('');
        setAddError(null);
        setAddSuccess(null);

        // bump key to force remount inputs (helps defeating browser autofill)
        setAddFormKey(k => k + 1);
        setShowAddModal(true);

        // small DOM-clears after modal is mounted to defeat late autofill by browsers
        // first pass shortly after open — focus email
        setTimeout(() => {
            try {
                setMgrEmail(''); // ensure React state empty
                setMgrPassword(''); // ensure React state empty

                const emailInput = document.getElementById(`mgrEmail`) as HTMLInputElement | null;
                const pwdInput = document.getElementById(`admin-create-password`) as HTMLInputElement | null;

                if (emailInput) {
                    emailInput.value = '';
                    emailInput.focus();
                    // dispatch an input event so some native listeners notice change
                    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (pwdInput) {
                    pwdInput.value = '';
                    pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } catch (e) {
                // ignore DOM access errors
            }
        }, 50);

        // second pass a bit later to remove very-late autofill
        setTimeout(() => {
            try {
                setMgrEmail('');
                setMgrPassword('');
                const emailInput = document.getElementById(`mgrEmail`) as HTMLInputElement | null;
                const pwdInput = document.getElementById(`admin-create-password`) as HTMLInputElement | null;
                if (emailInput) { emailInput.value = ''; emailInput.dispatchEvent(new Event('input', { bubbles: true })); }
                if (pwdInput) { pwdInput.value = ''; pwdInput.dispatchEvent(new Event('input', { bubbles: true })); }
            } catch (e) { /* ignore */ }
        }, 350);
    }


    // Add manager modal submit
    async function handleAddManager(ev?: React.FormEvent) {
        if (ev) ev.preventDefault();
        setAddError(null);
        setAddSuccess(null);

        const eTrim = mgrEmail.trim().toLowerCase();
        if (!mgrNom.trim() || !mgrPrenom.trim()) {
            setAddError('Prénom et nom requis.');
            return;
        }
        if (!validateEmail(eTrim)) {
            setAddError('Email invalide.');
            return;
        }
        if (mgrPassword.length < 8 || passwordStrength(mgrPassword) < 3) {
            setAddError('Mot de passe faible — au moins 8 caractères, majuscule, chiffre et symbole recommandé.');
            return;
        }

        setAdding(true);
        try {
            const payload = {
                nom: mgrNom.trim(),
                prenom: mgrPrenom.trim(),
                email: eTrim,
                telephone: mgrTelephone.trim() || null,
                adresse: mgrAdresse.trim() || null,
                mot_de_passe: mgrPassword,
                role: 'administrateur'
            };
            const res = await api.postJson('/admin/managers', payload);
            setAddSuccess(res?.message || 'Gestionnaire créé.');
            // reset form
            setMgrNom('');
            setMgrPrenom('');
            setMgrEmail('');
            setMgrTelephone('');
            setMgrAdresse('');
            setMgrPassword('');
            setShowAddModal(false);
            // refresh lists
            refreshActive(1);
            refreshInactive(1);
        } catch (err: any) {
            setAddError(err?.data?.message || err?.message || 'Erreur création gestionnaire.');
        } finally {
            setAdding(false);
        }
    }

    // logout (await the API, but don't block if it fails)
    async function handleLogout() {
        await api.postJson('/auth/logout', {}).catch(() => { /* ignore */ });
        try {
            globalThis.localStorage.setItem('panier:loggedOutAt', String(Date.now()));
            globalThis.localStorage.removeItem('utilisateur');
            globalThis.localStorage.removeItem('panier');
        } catch (e) {
            // ignore
        }
        globalThis.location.href = '/login';
    }

    // table header sort
    function handleSortClick(field: string) {
        if (field === sortField) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        else {
            setSortField(field);
            setSortDir('desc');
        }
    }

    function renderTable(rows: PanierRow[]) {
        return (
            <div className="table-wrapper">
                <table className="admin-table" cellPadding={6} cellSpacing={0}>
                    <thead>
                    <tr>
                        <th onClick={() => handleSortClick('numero_carte')}>Carte</th>
                        <th onClick={() => handleSortClick('nom')}>Nom</th>
                        <th onClick={() => handleSortClick('prenom')}>Prénom</th>
                        <th onClick={() => handleSortClick('email')}>Email</th>
                        <th onClick={() => handleSortClick('points')}>Points</th>

                        <th className="date-col" onClick={() => handleSortClick('last_utilisation')}>Dernière utilisation</th>
                        <th className="date-col" onClick={() => handleSortClick('date_ouverture')}>Date ouverture</th>
                        <th className="date-col" onClick={() => handleSortClick('date_expiration')}>Expiration</th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: 12 }}>Aucun résultat</td>
                        </tr>
                    )}
                    {rows.map(r => (
                        <tr key={r.panier_id}>
                            <td className="monospace">{r.numero_carte ?? '—'}</td>
                            <td>{r.nom ?? ''}</td>
                            <td>{r.prenom ?? ''}</td>
                            <td className="small">{r.email ?? ''}</td>
                            <td className="mono">{r.points ?? 0}</td>

                            <td className="date-col small">{r.last_utilisation ? formatDate(r.last_utilisation) : 'Jamais'}</td>
                            <td className="date-col small">{r.date_ouverture ? formatDate(r.date_ouverture) : '—'}</td>
                            <td className="date-col small">{formatDate(r.date_expiration)}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        );
    }

    if (missingManagerIdError) {
        return (
            <div className="login-page" style={{ alignItems: 'flex-start', paddingTop: 22 }}>
                <div className="login-card" style={{ maxWidth: '880px', width: '100%' }}>
                    <h2>Erreur</h2>
                    <div className="error" role="alert">{missingManagerIdError}</div>
                    <div style={{ marginTop: 12 }}>
                        <Link to="/login" className="button-primary">Retour</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page" style={{ alignItems: 'flex-start', paddingTop: 22 }}>
            <div className="login-card" style={{ maxWidth: '1100px', width: '100%' }}>
                <div className="admin-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={logo} alt="Logo" style={{ width: 84, height: 'auto', objectFit: 'contain', borderRadius: 6 }} />
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0 }}>Espace gestionnaire</h2>
                        <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                            {utilisateur ? `${utilisateur.prenom ?? ''} ${utilisateur.nom ?? ''}`.trim() : ''}
                        </div>
                    </div>

                    <div className="logout-anchor">
                        <button type="button" className="panel-logout" onClick={handleLogout} title="Se déconnecter">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
                                <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M21 12H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M13 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                    <Link to="/forgot-password" className="button-primary" style={{ width: 220 }}>Réinitialiser mot de passe</Link>
                    <button className="button-primary" style={{ width: 220 }} onClick={openAddModal}>Ajouter gestionnaire</button>                </div>

                {/* Add manager modal */}
                {showAddModal && (
                    <div className="modal-backdrop" role="dialog" aria-modal="true">
                        <div className="modal-card" role="document">
                            <h3>Ajouter un gestionnaire</h3>
                            {addError && <div className="error" role="alert">{addError}</div>}
                            {addSuccess && <div className="small">{addSuccess}</div>}

                            {/* Hidden dummy inputs to absorb browser autofill */}
                            <div style={{ position: 'absolute', left: -9999, top: -9999, width: 1, height: 1, overflow: 'hidden' }} aria-hidden>
                                <input name="fake-user" autoComplete="username" />
                                <input name="fake-pass" autoComplete="new-password" />
                            </div>

                            <form key={addFormKey} onSubmit={handleAddManager} className="login-form" autoComplete="off">
                                <label htmlFor="mgrPrenom">Prénom</label>
                                <input id="mgrPrenom" autoComplete="given-name" value={mgrPrenom} onChange={e => setMgrPrenom(e.target.value)} />

                                <label htmlFor="mgrNom">Nom</label>
                                <input id="mgrNom" autoComplete="family-name" value={mgrNom} onChange={e => setMgrNom(e.target.value)} />

                                <label htmlFor="mgrEmail">Email</label>
                                <input id="mgrEmail" name={`mgr_email_${addFormKey}`} autoComplete="off" type="email" value={mgrEmail} onChange={e => setMgrEmail(e.target.value)} />

                                <label htmlFor="mgrTelephone">Téléphone</label>
                                <input id="mgrTelephone" autoComplete="tel" value={mgrTelephone} onChange={e => setMgrTelephone(e.target.value)} />

                                <label htmlFor="mgrAdresse">Adresse</label>
                                <input id="mgrAdresse" autoComplete="street-address" value={mgrAdresse} onChange={e => setMgrAdresse(e.target.value)} />

                                <label htmlFor="mgrPassword">Mot de passe</label>
                                <PasswordInput
                                    key={`pwd_${addFormKey}`}
                                    value={mgrPassword}
                                    onChange={setMgrPassword}
                                    id="admin-create-password"
                                    name={`mot_de_passe_${addFormKey}`}
                                    placeholder="Mot de passe"
                                    required
                                    autoComplete="new-password"
                                />

                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                                    <div className="pwd-strength" aria-hidden>
                                        <div className={`bar s${passwordStrength(mgrPassword)}`} />
                                        <div className={`bar s${passwordStrength(mgrPassword) >= 2 ? 2 : 1}`} />
                                        <div className={`bar s${passwordStrength(mgrPassword) >= 3 ? 3 : 1}`} />
                                        <div className={`bar s${passwordStrength(mgrPassword) >= 4 ? 4 : 1}`} />
                                    </div>
                                    <div className="small" style={{ marginLeft: 8 }}>Force: {passwordStrength(mgrPassword)}/4</div>
                                </div>

                                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                                    <button className="button-primary" type="submit" disabled={adding}>{adding ? 'Création...' : 'Créer'}</button>
                                    <button type="button" className="button-secondary" onClick={() => setShowAddModal(false)}>Annuler</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <div className="admin-controls" style={{ display: 'flex', gap: 12, marginTop: 18, alignItems: 'center' }}>
                    <input placeholder="Recherche (nom, prénom, email, n° carte)" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)' }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Trier par
                        <select value={sortField} onChange={e => setSortField(e.target.value)} style={{ padding: 6 }}>
                            <option value="last_utilisation">Dernière utilisation</option>
                            <option value="date_ouverture">Date ouverture</option>
                            <option value="points">Points</option>
                            <option value="nom">Nom</option>
                            <option value="numero_carte">N° carte</option>
                        </select>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Direction
                        <select value={sortDir} onChange={e => setSortDir(e.target.value as 'asc'|'desc')} style={{ padding: 6 }}>
                            <option value="desc">Desc</option>
                            <option value="asc">Asc</option>
                        </select>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Taille
                        <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ padding: 6 }}>
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                        </select>
                    </label>
                </div>

                <div className="admin-tables" style={{ marginTop: 18 }}>
                    <section className="card" aria-labelledby="active-title" style={{ marginBottom: 14 }}>
                        <h3 id="active-title">Cartes actives</h3>
                        {activeError && <div className="error" role="alert">{activeError}</div>}
                        {activeLoading ? <div className="small">Chargement…</div> : renderTable(activeRows)}
                        <div className="pagination-controls" style={{ marginTop: 8 }}>
                            <div className="page-info">Page {activePage} / {activeTotalPages}</div>
                            <div style={{ marginLeft: 'auto' }}>
                                <button className="button-primary" onClick={() => refreshActive(Math.max(1, activePage-1))} disabled={activePage<=1}>Préc</button>
                                <button className="button-primary" onClick={() => refreshActive(Math.min(activeTotalPages, activePage+1))} style={{ marginLeft: 8 }} disabled={activePage>=activeTotalPages}>Suiv</button>
                            </div>
                        </div>
                    </section>

                    <section className="card" aria-labelledby="inactive-title">
                        <h3 id="inactive-title">Cartes inactives</h3>
                        {inactiveError && <div className="error" role="alert">{inactiveError}</div>}
                        {inactiveLoading ? <div className="small">Chargement…</div> : renderTable(inactiveRows)}
                        <div className="pagination-controls" style={{ marginTop: 8 }}>
                            <div className="page-info">Page {inactivePage} / {inactiveTotalPages}</div>
                            <div style={{ marginLeft: 'auto' }}>
                                <button className="button-primary" onClick={() => refreshInactive(Math.max(1, inactivePage-1))} disabled={inactivePage<=1}>Préc</button>
                                <button className="button-primary" onClick={() => refreshInactive(Math.min(inactiveTotalPages, inactivePage+1))} style={{ marginLeft: 8 }} disabled={inactivePage>=inactiveTotalPages}>Suiv</button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
