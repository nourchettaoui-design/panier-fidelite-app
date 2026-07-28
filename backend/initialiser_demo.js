// initialiser_demo.js (FR) — updated (no date_maj on utilisateurs)
// Usage:
//   cd backend
//   npm install bcryptjs
//   node initialiser_demo.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const START_SEQ = Number(process.env.START_SEQ || '111');
const DEMO_PWD_PREFIX = process.env.DEMO_PWD_PREFIX || 'Mymarket';
const DEMO_PWD_SUFFIX = process.env.DEMO_PWD_SUFFIX || '$';

let seqCounter = START_SEQ;
function motDePasseSequence(prefix = DEMO_PWD_PREFIX, suffix = DEMO_PWD_SUFFIX) {
    const pw = `${prefix}${seqCounter}${suffix}`;
    seqCounter++;
    return pw;
}

function parseCSV(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const rows = [];
    let header = null;
    for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        if (t.startsWith('#')) continue;
        const parts = line.split(';').map(s => s.trim());
        if (!header) {
            header = parts.map(h => (h || '').toLowerCase());
            continue;
        }
        const obj = {};
        for (let i = 0; i < header.length; i++) {
            obj[header[i]] = parts[i] !== undefined ? parts[i] : '';
        }
        rows.push(obj);
    }
    return rows;
}

function parseDateISOOrNull(input) {
    if (!input) return null;
    const s = String(input).trim();
    if (!s) return null;

    const tryDate = (str) => {
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d;
        return null;
    };

    const candidates = [];
    candidates.push(s);
    candidates.push(s.replace(/\//g, '-'));

    const m1 = s.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
    if (m1) {
        candidates.push(`${m1[3]}-${m1[2]}-${m1[1]}`);
        candidates.push(`${m1[3]}-${m1[2]}-${m1[1]}T00:00:00Z`);
    }

    const m2 = s.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);
    if (m2) candidates.push(`${m2[1]}-${m2[2]}-${m2[3]}`);

    for (const c of candidates) {
        const d = tryDate(c);
        if (d) return d.toISOString();
    }
    return null;
}

async function ensureUser({ nom, prenom, email, telephone = null, adresse = null, role = 'utilisateur', mot_de_passe = null }, client) {
    if (!client) throw new Error('client PG requis');
    const qFind = 'SELECT id, mot_de_passe FROM utilisateurs WHERE email = $1 LIMIT 1';
    const r = await client.query(qFind, [email]);
    if (r.rowCount > 0) {
        const id = r.rows[0].id;
        // <-- removed date_maj update here to avoid referencing a column that may not exist
        await client.query('UPDATE utilisateurs SET nom = $1, prenom = $2, telephone = $3, adresse = $4, role = $5 WHERE id = $6', [nom, prenom, telephone, adresse, role, id]);
        const existingHash = r.rows[0].mot_de_passe;
        let passwordWasSet = false;
        if (mot_de_passe && !existingHash) {
            const hash = await bcrypt.hash(mot_de_passe, 10);
            await client.query('UPDATE utilisateurs SET mot_de_passe = $1 WHERE id = $2', [hash, id]);
            passwordWasSet = true;
        }
        return { id, existed: true, passwordWasSet };
    } else {
        const qInsert = `INSERT INTO utilisateurs (nom, prenom, email, telephone, adresse, mot_de_passe, role, date_creation)
                         VALUES ($1,$2,$3,$4,$5,$6,$7, now()) RETURNING id`;
        const hash = mot_de_passe ? await bcrypt.hash(mot_de_passe, 10) : null;
        const res = await client.query(qInsert, [nom, prenom, email, telephone, adresse, hash, role]);
        return { id: res.rows[0].id, existed: false, passwordWasSet: !!mot_de_passe };
    }
}

function isValid12Digits(s) {
    return typeof s === 'string' && /^[0-9]{12}$/.test(s);
}

async function generateUnique12Digit(client) {
    if (!client) throw new Error('client PG requis');
    for (let i = 0; i < 200; i++) {
        const candidate = String(Math.floor(100000000000 + Math.random() * 900000000000));
        const r = await client.query('SELECT 1 FROM paniers_fidelite WHERE numero_carte = $1 LIMIT 1', [candidate]);
        if (r.rowCount === 0) return candidate;
    }
    return String(Date.now()).slice(-12).padStart(12, '0');
}

async function createPanier({ utilisateur_id, numero_carte, last_utilisation = null, date_ouverture_raw = null, actif = true, date_desactivation = null, points = 0, supprime = false }, client) {
    if (!client) throw new Error('client PG requis');

    let num = (numero_carte || '').toString().trim();
    if (!isValid12Digits(num)) {
        num = await generateUnique12Digit(client);
    } else {
        const r = await client.query('SELECT 1 FROM paniers_fidelite WHERE numero_carte = $1 LIMIT 1', [num]);
        if (r.rowCount > 0) {
            num = await generateUnique12Digit(client);
        }
    }

    let willBeActive = (actif === true || String(actif).toLowerCase() === 'true') && !supprime;

    if (willBeActive) {
        const qActive = 'SELECT id FROM paniers_fidelite WHERE utilisateur_id = $1 AND actif = true AND (supprime IS NULL OR supprime = false) LIMIT 1';
        const rActive = await client.query(qActive, [utilisateur_id]);
        if (rActive.rowCount > 0) {
            const oldId = rActive.rows[0].id;
            const qUpdateOld = `
              UPDATE paniers_fidelite
              SET actif = false,
                  date_desactivation = COALESCE(date_desactivation, now()),
                  raison_desactivation = COALESCE(raison_desactivation, 'remplacement'),
                  date_maj = now()
              WHERE id = $1
            `;
            await client.query(qUpdateOld, [oldId]);
            console.info(`createPanier : ancien panier ${oldId} désactivé (remplacement) pour utilisateur ${utilisateur_id}`);
        }
    }

    const parsedLastUtilISO = parseDateISOOrNull(last_utilisation);
    const parsedOpenISO = parseDateISOOrNull(date_ouverture_raw);

    const openingDateISO = parsedOpenISO ? parsedOpenISO : (parsedLastUtilISO ? parsedLastUtilISO : (new Date()).toISOString());
    const openingDate = openingDateISO.slice(0, 10);
    const lastUtilISO = parsedLastUtilISO ? parsedLastUtilISO : null;

    const q = `
      INSERT INTO paniers_fidelite
        (utilisateur_id, numero_carte, date_ouverture, last_utilisation, date_expiration, points, actif, date_maj, date_desactivation, supprime)
      VALUES ($1, $2, $3, $4, NULL, $5, $6, now(), $7, $8)
      RETURNING id
    `;
    const res = await client.query(q, [utilisateur_id, num, openingDate, lastUtilISO, Number(points || 0), willBeActive, date_desactivation || null, supprime]);
    return res.rows[0].id;
}

function normalizeRole(role) {
    if (!role) return 'utilisateur';
    const r = String(role).toLowerCase().trim();
    if (['administrateur', 'manager', 'admin'].includes(r)) return 'administrateur';
    if (['utilisateur', 'client', 'user'].includes(r)) return 'utilisateur';
    return r;
}

async function deleteUsersByEmails(emails, client) {
    if (!emails || emails.length === 0) return [];
    const qDel = 'DELETE FROM utilisateurs WHERE email = ANY($1) RETURNING id, email';
    const res = await client.query(qDel, [emails]);
    return res.rows;
}

async function run() {
    console.log('initialiser_demo : démarrage');

    const backendDir = path.resolve(__dirname);
    const utilisateursPath = path.join(backendDir, 'data', 'utilisateurs.csv');
    const paniersPath = path.join(backendDir, 'data', 'paniers.csv');

    if (!fs.existsSync(utilisateursPath)) {
        console.error('Fichier manquant :', utilisateursPath);
        process.exit(1);
    }
    if (!fs.existsSync(paniersPath)) {
        console.error('Fichier manquant :', paniersPath);
        process.exit(1);
    }

    const usersCsv = parseCSV(utilisateursPath);
    const paniersCsv = parseCSV(paniersPath);

    const paniersByEmail = {};
    for (const p of paniersCsv) {
        const email = (p.email || '').toLowerCase();
        if (!email) continue;
        if (!paniersByEmail[email]) paniersByEmail[email] = [];
        paniersByEmail[email].push(p);
    }

    for (const emailKey of Object.keys(paniersByEmail)) {
        const arr = paniersByEmail[emailKey];
        let seenActive = false;
        for (const card of arr) {
            const isActive = (card.actif || 'true').toString().toLowerCase() === 'true';
            if (isActive) {
                if (!seenActive) {
                    seenActive = true;
                } else {
                    card.actif = 'false';
                    card.raison_auto = 'multiple_active_from_csv_set_inactive';
                }
            }
        }
    }

    const emailsToTarget = usersCsv.map(u => (u.email || '').toLowerCase()).filter(e => e);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        console.log('Suppression des utilisateurs listés dans utilisateurs.csv (si présents)...');
        const deleted = await deleteUsersByEmails(emailsToTarget, client);
        console.log(`Suppression effectuée : ${deleted.length} utilisateur(s).`);

        for (const u of usersCsv) {
            const nom = u.nom || '';
            const prenom = u.prenom || '';
            const email = (u.email || '').toLowerCase();
            if (!email) {
                console.warn('Ligne utilisateurs.csv ignorée (email manquant).');
                continue;
            }
            const telephone = u.telephone || null;
            const adresse = u.adresse || null;
            const role = normalizeRole(u.role || 'utilisateur');
            const givePassword = (u.give_password || '').toLowerCase() === 'yes';

            const password = givePassword ? motDePasseSequence() : null;

            const userRes = await ensureUser({
                nom, prenom, email, telephone, adresse, role, mot_de_passe: password
            }, client);

            if (role === 'utilisateur') {
                const cards = paniersByEmail[email] || [];

                if (cards.length === 0) {
                    const generated = await generateUnique12Digit(client);
                    await createPanier({ utilisateur_id: userRes.id, numero_carte: generated, last_utilisation: null, date_ouverture_raw: null, actif: true }, client);
                } else {
                    for (const card of cards) {
                        const numero = (card.numero_carte || '').trim();
                        const last_utilisation_raw = (card.last_utilisation || '').trim() || null;
                        const date_ouverture_raw = (card.date_ouverture || '').trim() || null;
                        const actif = (card.actif || 'true').toLowerCase() === 'true';
                        const date_desactivation = (card.date_desactivation || '').trim() || null;
                        const points = Number(card.points || 0);

                        const newPanierId = await createPanier({
                            utilisateur_id: userRes.id,
                            numero_carte: numero,
                            last_utilisation: last_utilisation_raw,
                            date_ouverture_raw: date_ouverture_raw,
                            actif,
                            date_desactivation: date_desactivation || null,
                            points
                        }, client);

                        if (Number(points || 0) !== 0) {
                            const parsedTxISO = parseDateISOOrNull(last_utilisation_raw);
                            const txTimestamp = parsedTxISO ? parsedTxISO : (new Date()).toISOString();
                            const annee = (new Date(txTimestamp)).getFullYear();
                            const type = Number(points) > 0 ? 'credit' : 'debit';
                            const motif = 'Solde historique';
                            const qTx = `
                                INSERT INTO points_transactions (panier_id, type, montant, motif, annee, date_creation)
                                VALUES ($1,$2,$3,$4,$5,$6)
                            `;
                            const montant = Number(points);
                            await client.query(qTx, [newPanierId, type, montant, motif, annee, txTimestamp]);
                        }
                    }
                }
            } else {
                // administrateur : pas de paniers à créer
            }
        }

        await client.query('COMMIT');

        console.log('initialiser_demo : terminé. Les mots de passe (si générés) ont été hachés et ne sont pas affichés.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('initialiser_demo : erreur', err);
        process.exitCode = 1;
    } finally {
        client.release();
    }
}

run().catch(err => { console.error('Erreur fatale dans initialiser_demo :', err); process.exit(1); });
