const request = require('supertest');
const express = require('express');

jest.useRealTimers();

describe('GET /admin/:managerId/paniers (list)', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    function buildApp({ requester }) {
        // mock pool: respond to COUNT and main query based on SQL contents
        const mockPool = {
            query: jest.fn(async (sql, params) => {
                // COUNT query
                if (/SELECT\s+COUNT\(\*\)/i.test(sql)) {
                    return { rowCount: 1, rows: [{ total: 2 }] };
                }
                // main query: return two rows
                if (/FROM\s+paniers_fidelite/i.test(sql) && /LIMIT/i.test(sql)) {
                    return {
                        rowCount: 2,
                        rows: [
                            { panier_id: 1, numero_carte: 'A', utilisateur_id: 5, nom: 'User', prenom: 'One', email: 'u1@example.com', points: 0, actif: true },
                            { panier_id: 2, numero_carte: 'B', utilisateur_id: 5, nom: 'User', prenom: 'One', email: 'u1@example.com', points: 5, actif: true }
                        ]
                    };
                }
                return { rowCount: 0, rows: [] };
            })
        };
        jest.doMock('../db', () => mockPool);

        const adminRouter = require('../routes/admin');
        const app = express();
        app.use(express.json());
        // middleware to set req.utilisateur
        app.use((req, res, next) => {
            req.utilisateur = requester || null;
            next();
        });
        app.use('/admin', adminRouter);
        return { app, mocks: { mockPool } };
    }

    test('unauthenticated -> 401', async () => {
        const { app } = buildApp({ requester: null });
        const res = await request(app).get('/admin/5/paniers');
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: 'Non authentifié.' });
    });

    test('invalid managerId -> 400', async () => {
        const { app } = buildApp({ requester: { id: 1, role: 'administrateur' } });
        const res = await request(app).get('/admin/abc/paniers');
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'Identifiant manager invalide.' });
    });

    test('non-admin requesting another manager -> 403', async () => {
        // requester id 10 trying to get managerId 5 -> forbidden
        const { app } = buildApp({ requester: { id: 10, role: 'utilisateur' } });
        const res = await request(app).get('/admin/5/paniers');
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ message: 'Accès refusé.' });
    });

    test('admin can list paniers (returns pagination + rows)', async () => {
        const { app, mocks } = buildApp({ requester: { id: 1, role: 'administrateur' } });
        const res = await request(app).get('/admin/5/paniers?page=1&pageSize=5&sortField=last_utilisation&sortDir=desc');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('page', 1);
        expect(res.body).toHaveProperty('pageSize', 5);
        expect(res.body).toHaveProperty('total', 2);
        expect(res.body).toHaveProperty('rows');
        expect(Array.isArray(res.body.rows)).toBe(true);
        expect(res.body.rows.length).toBe(2);
        // ensure DB query was called for COUNT and main query
        expect(mocks.mockPool.query).toHaveBeenCalled();
    });

    test('owner (non-admin) can list only their own paniers', async () => {
        // requester id 5 requesting managerId 5
        const { app } = buildApp({ requester: { id: 5, role: 'utilisateur' } });
        const res = await request(app).get('/admin/5/paniers');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('rows');
        expect(res.body.rows.length).toBe(2);
    });
});
