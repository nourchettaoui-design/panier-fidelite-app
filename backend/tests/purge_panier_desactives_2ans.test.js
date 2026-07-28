jest.useRealTimers();

describe('purge_panier_desactives_2ans job', () => {
    let releaseResolve;
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('runs DELETE and commits, then releases client', async () => {
        // promise that resolves when client.release() is called
        const releasePromise = new Promise((resolve) => {
            releaseResolve = resolve;
        });

        // mock client
        const mockClient = {
            query: jest.fn(async (sql) => {
                if (/^\s*BEGIN/i.test(sql)) return;
                if (/DELETE\s+FROM\s+paniers_fidelite/i.test(sql)) {
                    return { rowCount: 2, rows: [{ id: 1, utilisateur_id: 10 }, { id: 2, utilisateur_id: 11 }] };
                }
                if (/^\s*COMMIT/i.test(sql)) return;
                if (/^\s*ROLLBACK/i.test(sql)) return;
            }),
            release: jest.fn(() => releaseResolve()),
        };

        // mock pool.connect to return the mockClient
        const mockPool = { connect: jest.fn().mockResolvedValue(mockClient) };
        jest.doMock('../db', () => mockPool);

        // suppress console output in test run
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // require the job (it runs immediately)
        require('../jobs/purge_panier_desactives_2ans.js');

        // wait until release() is called by the job
        await releasePromise;

        // assertions
        expect(mockPool.connect).toHaveBeenCalled();
        // Ensure we ran DELETE from paniers_fidelite
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/DELETE\s+FROM\s+paniers_fidelite/i));
        // Ensure BEGIN + COMMIT were called
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/BEGIN/i));
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/COMMIT/i));

        // restore spies
        logSpy.mockRestore();
        errSpy.mockRestore();
    });
});
