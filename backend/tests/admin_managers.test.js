const request = require('supertest');
const express = require('express');

jest.useRealTimers();

describe('POST /admin/managers (create manager)', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    function buildApp({ requester, findResult, insertResult, bcryptHash = 'hashedpw' }) {
        // mock pool.query: first SELECT then INSERT
        const mockPool = {
            query: jest.fn(async (sql, params) => {
                if (/SELECT id FROM utilisateurs/i.test(sql)) {
                    // return existing user if findResult provided
                    return findResult || { rowCount: 0, rows: [] };
                }
                if (/INSERT INTO utilisateurs/i.test(sql)) {
                    return insertResult || { rowCount: 1, rows: [{ id: 999, nom: params[0], prenom: params[1], email: params[2], role: params[6] }] };
                }
                return { rowCount: 0, rows: [] };
            })
        };

        jest.doMock('../db', () => mockPool);

        // mock bcrypt.hash
        jest.doMock('bcryptjs', () => ({ hash: jest.fn(async () => bcryptHash) }));

        const adminRouter = require('../routes/admin');
        const app = express();
        app.use(express.json());
        // set both req.utilisateur and req.session.utilisateur so verifierAdministrateur (which checks session)
        // and any route code that reads req.utilisateur both work in tests.
        app.use((req, res, next) => {
            req.utilisateur = requester || null;
            // ensure session object exists and contains utilisateur for the auth middleware
            req.session = req.session || {};
            if (requester) {
                req.session.utilisateur = requester;
            } else {
                // explicit null to simulate no session
                req.session.utilisateur = null;
            }
            next();
        });
        app.use('/admin', adminRouter);
        return { app, mocks: { mockPool } };
    }

    test('missing required fields -> 400', async () => {
        const { app } = buildApp({ requester: { id: 1, role: 'administrateur' } });
        const res = await request(app).post('/admin/managers').send({ nom: 'A' }); // missing many fields
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'nom, prenom, email et mot_de_passe sont requis.' });
    });

    test('duplicate email -> 409', async () => {
        const findResult = { rowCount: 1, rows: [{ id: 2 }] }; // simulate existing user
        const { app } = buildApp({
            requester: { id: 1, role: 'administrateur' },
            findResult
        });
        const payload = { nom: 'N', prenom: 'P', email: 'dup@example.com', mot_de_passe: 'Password1!' };
        const res = await request(app).post('/admin/managers').send(payload);
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ message: 'Un utilisateur avec cet email existe déjà.' });
    });

    test('successful creation -> returns utilisateur + message', async () => {
        const { app, mocks } = buildApp({
            requester: { id: 1, role: 'administrateur' },
            findResult: { rowCount: 0, rows: [] },
            insertResult: { rowCount: 1, rows: [{ id: 77, nom: 'Nom', prenom: 'Prenom', email: 'new@example.com', role: 'administrateur' }] }
        });
        const payload = { nom: 'Nom', prenom: 'Prenom', email: 'new@example.com', mot_de_passe: 'Password1!' };
        const res = await request(app).post('/admin/managers').send(payload);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Gestionnaire créé.');
        expect(res.body).toHaveProperty('utilisateur');
        expect(res.body.utilisateur).toMatchObject({ id: 77, email: 'new@example.com' });
        // Ensure db.insert was called
        expect(mocks.mockPool.query).toHaveBeenCalled();
    });
});
