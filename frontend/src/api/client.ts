// frontend/src/api/client.ts
const API_BASE = (import.meta.env.VITE_API_URL as string) || '';

function buildUrl(path: string) {
    const base = API_BASE.replace(/\/+$/, '');
    return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

function handleAuthExpired() {
    try {
        localStorage.setItem('panier:loggedOutAt', String(Date.now()));
        // Clear client caches so stale UI doesn't persist
        localStorage.removeItem('utilisateur');
        localStorage.removeItem('panier');
    } catch (e) { /* ignore */ }

    // Flash message for the login page
    sessionStorage.setItem('authMessage', 'Votre session a expiré. Veuillez vous reconnecter.');

    // Preserve requested path
    const next = window.location.pathname + window.location.search;

    // URL is not the SPA root.
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
}


async function handleResponse(res: Response) {
    if (res.status === 401) {
        // Unauthenticated / session expired
        handleAuthExpired();
        // throw to stop promise chain
        const err: any = new Error('Session expirée');
        err.status = 401;
        throw err;
    }

    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }

    if (!res.ok) {
        const error: any = new Error(data?.message || res.statusText || 'Erreur réseau');
        error.status = res.status;
        error.data = data;
        throw error;
    }
    return data;
}

export async function request(path: string, options: RequestInit = {}) {
    const url = buildUrl(path);
    const init: RequestInit = {
        credentials: 'include',
        headers: { 'Accept': 'application/json', ...(options.headers || {}) },
        ...options
    };
    if (init.body && typeof init.body === 'object' && !(init.body instanceof FormData)) {
        init.headers = { ...(init.headers as Record<string, string>), 'Content-Type': 'application/json' };
        init.body = JSON.stringify(init.body);
    }
    const res = await fetch(url, init);
    return handleResponse(res);
}

export async function postJson(path: string, body: any) { return request(path, { method: 'POST', body }); }
export async function getJson(path: string) { return request(path, { method: 'GET' }); }
export async function login(email: string, mot_de_passe: string) { return postJson('/auth/login', { email, mot_de_passe }); }

export default { request, postJson, getJson, login };
