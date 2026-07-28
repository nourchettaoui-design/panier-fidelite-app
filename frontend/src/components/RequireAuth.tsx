import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import api from '../api/client';

/**
 * RequireAuth:
 * - If App already performed the startup check (window.__sessionChecked is true), trust it.
 * - Otherwise wait for the shared window.__sessionPromise if present or create one (single fallback).
 * - This file avoids creating duplicate checks by reusing the shared promise.
 */
export default function RequireAuth({ children }: { children: React.ReactElement }) {
    const [status, setStatus] = React.useState<'checking' | 'ok' | 'no'>('checking');
    const loc = useLocation();

    React.useEffect(() => {
        let mounted = true;

        (async () => {
            const w = window as any;

            // If App already set the final result, trust it immediately
            if (w.__sessionChecked) {
                if (w.__sessionUser) {
                    if (mounted) setStatus('ok');
                } else {
                    if (mounted) setStatus('no');
                }
                return;
            }

            // If there's an in-flight shared promise, await it
            if (w.__sessionPromise) {
                try {
                    const u = await w.__sessionPromise;
                    if (u && u.id) {
                        if (mounted) setStatus('ok');
                    } else {
                        if (mounted) setStatus('no');
                    }
                    return;
                } catch (err) {
                    if (mounted) setStatus('no');
                    return;
                }
            }

            // No shared promise and no final result: create a single fallback shared promise.
            // This mirrors App's behavior so only one check runs.
            w.__sessionPromise = (async () => {
                try {
                    const me = await api.getJson('/auth/me'); // includes credentials
                    const u = me?.utilisateur ?? me ?? null;
                    if (u && u.id) {
                        try { localStorage.setItem('utilisateur', JSON.stringify(u)); } catch (e) { /* ignore */ }
                        w.__sessionChecked = true;
                        w.__sessionUser = u;
                        return u;
                    } else {
                        localStorage.removeItem('utilisateur');
                        localStorage.removeItem('panier');
                        w.__sessionChecked = true;
                        w.__sessionUser = null;
                        return null;
                    }
                } catch (err) {
                    localStorage.removeItem('utilisateur');
                    localStorage.removeItem('panier');
                    w.__sessionChecked = true;
                    w.__sessionUser = null;
                    return null;
                }
            })();

            try {
                const u = await w.__sessionPromise;
                if (u && u.id) {
                    if (mounted) setStatus('ok');
                } else {
                    if (mounted) setStatus('no');
                }
            } catch (err) {
                if (mounted) setStatus('no');
            }
        })();

        return () => { mounted = false; };
    }, []);

    if (status === 'checking') return <div>Chargement…</div>;
    if (status === 'no') return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;

    return children;
}
