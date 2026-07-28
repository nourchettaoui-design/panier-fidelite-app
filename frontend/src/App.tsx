import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminPage from './pages/AdminPage';
import ClientCart from './pages/ClientCart';
import MotDePasseOublie from './pages/MotDePasseOublie';
import RequireAuth from './components/RequireAuth';

/**
 * Minimal App.tsx for stable behaviour during development:
 * - ALWAYS redirect "/" -> "/login"
 * - Do NOT perform any global /auth/me check on app start
 * - RequireAuth will validate session for protected pages when they are visited
 */
export default function App() {
    // cross-tab logout sync (keeps previous behavior)
    React.useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'panier:loggedOutAt') {
                try {
                    localStorage.removeItem('utilisateur');
                    localStorage.removeItem('panier');
                } catch (err) { /* ignore */ }
                window.location.href = '/login';
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    return (
        <Routes>
            {/* Force landing page to login, never rely on stale localStorage here */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />


            <Route
                path="/client/:id/panier"
                element={
                    <RequireAuth>
                        <ClientCart />
                    </RequireAuth>
                }
            />

            <Route
                path="/admin/:id/paniers"
                element={
                    <RequireAuth>
                        <AdminPage />
                    </RequireAuth>
                }
            />

            <Route path="/forgot-password" element={<MotDePasseOublie />} />

        </Routes>
    );
}
