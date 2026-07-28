const request = require('supertest');
const express = require('express');

jest.useRealTimers();

describe('/auth/login', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    function buildAppWithMocks({ userQueryResult, panierQueryResult, hasActiveCartReturn = true, bcryptCompareReturn = true }) {
        // mock pool
        const mockClient = {
            query: jest.fn(async (sql, params) => {
                // Detect query by SQL fragments
                if (/FROM\s+utilisateurs/i.test(sql)) {
                    return userQueryResult;
                }
                if (/FROM\s+paniers_fidelite/i.test(sql)) {
                    return panierQueryResult;
                }
                // default
                return { rowCount: 0, rows: [] };
            })
        };
        const mockPool = { query: mockClient.query, connect: jest.fn() };

        // mock hasActiveCart
        const mockHasActiveCart = jest.fn(async (uid) => hasActiveCartReturn);

        // mock bcrypt.compare
        const mockBcrypt = {
            compare: jest.fn(async () => bcryptCompareReturn),
            hash: jest.fn(async () => 'hashed')
        };

        // Install mocks before requiring route
        jest.doMock('../db', () => mockPool);
        jest.doMock('../helpers/auth', () => ({ hasActiveCart: mockHasActiveCart }));
        jest.doMock('bcryptjs', () => mockBcrypt);

        // Build express app and mount router
        const loginRouter = require('../routes/auth');
        const app = express();
        app.use(express.json());
        // simple session stub
        app.use((req, res, next) => {
            req.session = {};
            next();
        });
        app.use('/auth', loginRouter);
        return { app, mocks: { mockPool, mockHasActiveCart, mockBcrypt, mockClient } };
    }

    test('missing email -> 400 email manquant', async () => {
        const { app } = buildAppWithMocks({ userQueryResult: { rowCount: 0, rows: [] } });
        const res = await request(app).post('/auth/login').send({ email: '', mot_de_passe: 'password123' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'email manquant' });
    });

    test('invalid email -> 400 email incorrect', async () => {
        const { app } = buildAppWithMocks({ userQueryResult: { rowCount: 0, rows: [] } });
        const res = await request(app).post('/auth/login').send({ email: 'not-an-email', mot_de_passe: 'password123' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'email incorrect' });
    });

    test('short password -> 400 length error', async () => {
        const { app } = buildAppWithMocks({ userQueryResult: { rowCount: 0, rows: [] } });
        const res = await request(app).post('/auth/login').send({ email: 'test@example.com', mot_de_passe: 'short' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'Le mot de passe doit contenir au moins 8 caractères.' });
    });

    test('user not found -> 401 email ou mot de passe incorrect', async () => {
        const { app, mocks } = buildAppWithMocks({ userQueryResult: { rowCount: 0, rows: [] } });
        const res = await request(app).post('/auth/login').send({ email: 'nouser@example.com', mot_de_passe: 'password123' });
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: 'email ou mot de passe incorrect' });
    });

    test('user exists but no mot_de_passe -> 403 no password set', async () => {
        const userRow = { id: 1, nom: 'X', prenom: 'Y', email: 'user@example.com', role: 'utilisateur', mot_de_passe: null };
        const { app } = buildAppWithMocks({ userQueryResult: { rowCount: 1, rows: [userRow] } });
        const res = await request(app).post('/auth/login').send({ email: 'user@example.com', mot_de_passe: 'password123' });
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ message: 'Aucun mot de passe défini pour ce compte.' });
    });

    test('wrong password -> 401 email ou mot de passe incorrect', async () => {
        const userRow = { id: 2, nom: 'A', prenom: 'B', email: 'u2@example.com', role: 'utilisateur', mot_de_passe: 'hashedpw' };
        const { app, mocks } = buildAppWithMocks({
            userQueryResult: { rowCount: 1, rows: [userRow] },
            panierQueryResult: { rowCount: 0, rows: [] },
            bcryptCompareReturn: false
        });
        const res = await request(app).post('/auth/login').send({ email: 'u2@example.com', mot_de_passe: 'wrongpassword' });
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: 'email ou mot de passe incorrect' });
    });

    test('admin login success -> returns utilisateur only (no cart check)', async () => {
        const userRow = { id: 10, nom: 'Admin', prenom: 'Root', email: 'admin@example.com', role: 'administrateur', mot_de_passe: 'h' };
        const { app, mocks } = buildAppWithMocks({
            userQueryResult: { rowCount: 1, rows: [userRow] },
            panierQueryResult: { rowCount: 0, rows: [] },
            hasActiveCartReturn: false, // should not be consulted for admin, but safe
            bcryptCompareReturn: true
        });

        const res = await request(app).post('/auth/login').send({ email: 'admin@example.com', mot_de_passe: 'adminPass123' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('utilisateur');
        expect(res.body.utilisateur).toMatchObject({ id: 10, email: 'admin@example.com', role: 'administrateur' });
        // Ensure no panier field (or panier null) – the route returns utilisateur alone for admin
        expect(res.body.panier).toBeUndefined();
    });

    test('utilisateur with no active cart -> 403 message about no active cart', async () => {
        const userRow = { id: 20, nom: 'U', prenom: 'V', email: 'u20@example.com', role: 'utilisateur', mot_de_passe: 'h' };
        const { app, mocks } = buildAppWithMocks({
            userQueryResult: { rowCount: 1, rows: [userRow] },
            panierQueryResult: { rowCount: 0, rows: [] },
            hasActiveCartReturn: false,
            bcryptCompareReturn: true
        });

        const res = await request(app).post('/auth/login').send({ email: 'u20@example.com', mot_de_passe: 'password123' });
        expect(res.status).toBe(403);
        expect(res.body).toEqual({
            message: "Vous n'avez pas de panier actif. Veuillez demander une carte fidélité en magasin."
        });
    });

    test('utilisateur with active cart -> returns utilisateur and panier', async () => {
        const userRow = { id: 30, nom: 'C', prenom: 'D', email: 'u30@example.com', role: 'utilisateur', mot_de_passe: 'h' };
        const panierRow = { id: 55, date_ouverture: '2024-01-01', date_expiration: null, points: 10, numero_carte: 'ABC', last_utilisation: '2025-01-01', actif: true };
        const { app, mocks } = buildAppWithMocks({
            userQueryResult: { rowCount: 1, rows: [userRow] },
            panierQueryResult: { rowCount: 1, rows: [panierRow] },
            hasActiveCartReturn: true,
            bcryptCompareReturn: true
        });

        const res = await request(app).post('/auth/login').send({ email: 'u30@example.com', mot_de_passe: 'password123' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('utilisateur');
        expect(res.body.utilisateur).toMatchObject({ id: 30, email: 'u30@example.com', role: 'utilisateur' });
        expect(res.body).toHaveProperty('panier');
        expect(res.body.panier).toMatchObject({ id: 55, points: 10, numero_carte: 'ABC' });
    });
});
