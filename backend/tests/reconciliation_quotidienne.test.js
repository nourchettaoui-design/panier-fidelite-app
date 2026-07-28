jest.useRealTimers();

describe('reconciliation_quotidienne job', () => {
    let releaseResolve;
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('runs UPDATE to deactivate expired carts and commits', async () => {
        const releasePromise = new Promise((resolve) => {
            releaseResolve = resolve;
        });

        const mockClient = {
            query: jest.fn(async (sql) => {
                if (/^\s*BEGIN/i.test(sql)) return;
                if (/UPDATE\s+paniers_fidelite/i.test(sql) && /date_expiration/i.test(sql)) {
                    return { rowCount: 3 };
                }
                if (/^\s*COMMIT/i.test(sql)) return;
                if (/^\s*ROLLBACK/i.test(sql)) return;
            }),
            release: jest.fn(() => releaseResolve()),
        };

        const mockPool = { connect: jest.fn().mockResolvedValue(mockClient) };
        jest.doMock('../db', () => mockPool);

        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        require('../jobs/reconciliation_quotidienne.js');

        await releasePromise;

        expect(mockPool.connect).toHaveBeenCalled();
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/BEGIN/i));
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/UPDATE\s+paniers_fidelite/i));
        // confirm the WHERE uses date_expiration < CURRENT_DATE
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/date_expiration\s+<\s+CURRENT_DATE/i));
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/COMMIT/i));

        logSpy.mockRestore();
        errSpy.mockRestore();
    });
});
