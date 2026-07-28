jest.useRealTimers();

describe('reset_points_fin_annee job', () => {
    let releaseResolve;
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('resets points to 0 for non-deleted carts and commits', async () => {
        const releasePromise = new Promise((resolve) => {
            releaseResolve = resolve;
        });

        const mockClient = {
            query: jest.fn(async (sql) => {
                if (/^\s*BEGIN/i.test(sql)) return;
                if (/UPDATE\s+paniers_fidelite/i.test(sql) && /SET\s+points\s+=\s+0/i.test(sql)) {
                    return { rowCount: 4 };
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

        require('../jobs/reset_points_fin_annee.js');

        await releasePromise;

        expect(mockPool.connect).toHaveBeenCalled();
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/BEGIN/i));
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/UPDATE\s+paniers_fidelite/i));
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/SET\s+points\s+=\s+0/i));
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/COMMIT/i));

        logSpy.mockRestore();
        errSpy.mockRestore();
    });
});
