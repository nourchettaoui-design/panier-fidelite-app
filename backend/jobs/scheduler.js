// backend/jobs/scheduler.js  (replace or create)
const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');

function runScript(name) {
    const scriptPath = path.join(__dirname, name);
    const child = spawn(process.execPath, [scriptPath], {
        stdio: ['ignore', 'inherit', 'inherit'],
        env: process.env,
    });

    child.on('error', (err) => {
        console.error(`Failed to start ${name}:`, err);
    });
    child.on('exit', (code, signal) => {
        if (code === 0) {
            console.log(`${name} finished successfully`);
        } else {
            console.error(`${name} exited with code ${code} ${signal ? '(' + signal + ')' : ''}`);
        }
    });
}

// Recommended scheduling:
// - daily reconciliation (expiration) at 03:00
cron.schedule('0 3 * * *', () => {
    console.log('Running reconciliation_quotidienne.js');
    runScript('reconciliation_quotidienne.js');
});

// - daily deactivate unused (1 year) at 03:10 (requires you to add deactivate_unused_1an.js)
cron.schedule('10 3 * * *', () => {
    console.log('Running deactivate_unused_1an.js');
    runScript('deactivate_unused_1an.js');
});

// - monthly purge (permanent delete) at 04:00 on the first of the month
cron.schedule('0 4 1 * *', () => {
    console.log('Running purge_panier_desactives_2ans.js');
    runScript('purge_panier_desactives_2ans.js');
});

// - yearly reset points (run once after Dec 31; here scheduled Jan 1 00:05)
cron.schedule('5 0 1 1 *', () => {
    console.log('Running reset_points_fin_annee.js');
    runScript('reset_points_fin_annee.js');
});

console.log('Scheduler started (node-cron).');
