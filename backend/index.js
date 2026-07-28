// backend/index.js
// Loads only the local backend/.env (overrides other envs) and runs the Express API.
//
// IMPORTANT: this file intentionally loads backend/.env explicitly and overrides existing
// process.env values so your local env is authoritative for the school project.

const path = require('path');
const dotenv = require('dotenv');

// Load backend/.env explicitly and override any existing process.env values
dotenv.config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const pool = require('./db');

const authMiddleware = require('./middlewares/authMiddleware');

const app = express();
app.set('trust proxy', 1);

const PORT = Number(process.env.PORT || 3001);

// parse JSON bodies
app.use(express.json());

/**
 * CORS configuration (uses only backend/.env VITE_APP_URL)
 * - If VITE_APP_URL is '*' then all origins are allowed (debug only).
 * - Requests with no Origin header (curl/postman/server-to-server) are allowed.
 */
const rawAllowed = (process.env.VITE_APP_URL || '').trim();
const allowedOrigins = rawAllowed
    ? rawAllowed.split(',').map(s => s.trim()).filter(Boolean)
    : []; // empty means none configured

const allowAllOrigins = allowedOrigins.length === 0 ? false
    : allowedOrigins.includes('*') || rawAllowed === '*';

const corsOptions = {
  origin: function(origin, callback) {
    // no origin (curl/postman) => allow
    if (!origin) return callback(null, true);

    if (allowAllOrigins) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // do NOT throw here (throwing produces a 500); signal "not allowed"
    console.warn('Blocked CORS origin (will return 403):', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// apply CORS middleware
app.use(cors(corsOptions));

// respond with 403 for disallowed origins (clear response, avoids 500)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();
  if (allowAllOrigins) return next();
  if (allowedOrigins.indexOf(origin) === -1) {
    return res.status(403).json({ message: 'CORS origin not allowed' });
  }
  return next();
});

/**
 * SESSION configuration
 * - cookie name: panier.sid (client expects this)
 * - secure only in production (requires HTTPS)
 */
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret';
const inProduction = process.env.NODE_ENV === 'production';

app.use(session({
  name: 'panier.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: false,
  cookie: {
    httpOnly: true,
    secure: inProduction,
    sameSite: 'lax',
    maxAge: 2 * 60 * 60 * 1000 // 2 hours
  }
}));

// Simple request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} -> ${req.method} ${req.originalUrl} - Origin: ${req.headers.origin || '-'} - Cookies: ${req.headers.cookie ? '[present]' : '[none]'}`);
  next();
});

// Routes
const authRouter = require('./routes/auth');
app.use('/auth', authRouter);

const passwordResetRouter = require('./routes/passwordReset');
app.use('/auth', passwordResetRouter);

// Admin routes protected by authMiddleware
const adminRoutes = require('./routes/admin');
app.use('/admin', authMiddleware, adminRoutes);

const utilisateursRouter = require('./routes/utilisateurs');
app.use('/utilisateurs', authMiddleware, utilisateursRouter);

// health / DB check
app.get('/panier-fidelite-db', async (req, res) => {
  try {
    const r = await pool.query('SELECT current_database() AS db, current_user AS user, now() AS now');
    res.json({ ok: true, db: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');

app.use(express.static(frontendDistPath));

app.get(/.*/, (req, res, next) => {
  if (
    req.path.startsWith('/auth') ||
    req.path.startsWith('/admin') ||
    req.path.startsWith('/utilisateurs') ||
    req.path.startsWith('/panier-fidelite-db')
  ) {
    return next();
  }

  res.sendFile(path.join(frontendDistPath, 'index.html'));
});
// generic error handler to avoid raw stack traces leaking
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && (err.stack || err.message || err));
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Erreur serveur interne.' });
});

app.listen(PORT, () => {
  console.log(`Serveur Express (dev) démarré sur le port ${PORT}`);
  console.log(`CORS autorisé pour: ${allowAllOrigins ? '[ALL]' : (allowedOrigins.length ? allowedOrigins.join(', ') : '[none]')}`);
});
