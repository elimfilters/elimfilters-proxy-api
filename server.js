// server.js — ELIMFILTERS API (estructura corregida para src/*)
require('dotenv').config();
const express = require('express');
const path = require('path');

let helmet;
try { helmet = require('helmet'); } catch (e) {
  console.warn("⚠️ Helmet no instalado, continuando.");
}

// ===============================
// IMPORTS ACTUALIZADOS (src/*)
// ===============================
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const GoogleSheetsService = require('./src/services/googleSheetsConnector');
const detectionService = require('./src/services/detectionService');

const normalizeQuery = require('./src/utils/normalizeQuery');

const businessLogic = require('./src/core/businessLogic');
const rulesProtection = require('./src/core/rulesProtection');

const REGLAS_MAESTRAS = require('./config/MASTER_RULES.json');
const OEM_RANKING = require('./config/oemRanking.json');
const DUTY_SECTORS = require('./config/dutySectors.json');

// ===============================
const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', parseInt(process.env.TRUST_PROXY || '1', 10));

// TRACKING IDs
app.use((req, _res, next) => {
  req.request_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  next();
});

process.on('unhandledRejection', (reason) => console.error('💥 unhandledRejection:', reason));
process.on('uncaughtException', (err) => console.error('💥 uncaughtException:', err));

// Helpers
function isValidAbsoluteUrl(url) {
  try { new URL(url); return true; } catch { return false; }
}
function isValidAliasQuery(q) {
  const s = String(q || '').trim();
  if (!s || s.length < 2 || s.length > 64) return false;
  return /^[A-Za-z0-9\-\/\s]+$/.test(s);
}

// Webhook breaker
const webhookBreaker = { failures: 0, openUntil: 0 };
function canUseWebhook() { return Date.now() > webhookBreaker.openUntil; }
function recordWebhookFailure() {
  webhookBreaker.failures += 1;
  if (webhookBreaker.failures >= 3) {
    webhookBreaker.openUntil = Date.now() + 5 * 60 * 1000;
  }
}
function recordWebhookSuccess() {
  webhookBreaker.failures = 0;
  webhookBreaker.openUntil = 0;
}
function isAllowedWebhookUrl(url) {
  try {
    const u = new URL(url);
    const allowed = (process.env.N8N_ALLOWED_HOSTS || "")
      .split(",").map(h => h.trim()).filter(Boolean);
    if (allowed.length === 0) return true;
    return allowed.includes(u.hostname);
  } catch {
    return false;
  }
}

// Security middleware
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
}

// CORS
const devOrigins = [
  "http://localhost:8000", "http://localhost:3000",
  "http://127.0.0.1:8000", "http://127.0.0.1:3000",
  "http://localhost:8010", "http://127.0.0.1:8010"
];

const envAllowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const allowedOrigins = [
  "https://elimfilters.com",
  "https://www.elimfilters.com",
  ...devOrigins,
  ...envAllowed
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.header("Access-Control-Allow-Origin", "*");
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// Parsers
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limit
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60
}));

const aliasLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.ALIAS_RATE_LIMIT_PER_MIN || "30", 10)
});

// Google Sheets
let sheetsInstance;
let server;

async function initializeServices() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    await sheetsInstance.ensureMasterHeaders();
    detectionService.setSheetsInstance(sheetsInstance);
    console.log("✅ Servicios inicializados");
  } catch (e) {
    console.error("❌ Error inicializando servicios:", e);
  }
}

// HEALTH
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    version: "3.8.3",
    sheets: sheetsInstance ? "connected" : "disconnected",
    endpoints: {
      search: "/api/v1/filters/search"
    }
  });
});

// MAIN SEARCH ENDPOINT
app.get('/api/v1/filters/search', async (req, res) => {
  try {
    const part = String(req.query.part || "").trim();
    console.log("🔍 Consulta:", part);

    if (!part) return res.status(400).json({ error: "Parámetro 'part' requerido" });
    if (!sheetsInstance) return res.status(503).json({ error: "Sheets no inicializado" });

    const queryNorm = normalizeQuery(part);
    const row = await sheetsInstance.findRowByQuery(queryNorm);

    if (row && row.found) {
      return res.json({ found: true, data: row });
    }

    const fallback = await detectionService.detectFilter(part, sheetsInstance);
    return res.json({ found: true, data: fallback });

  } catch (e) {
    console.error("💥 Error en search:", e);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PREFIXES
app.get('/api/v1/prefixes', (req, res) => {
  try {
    const pr = rulesProtection.getProtectedRules();
    res.json({ ok: true, prefixes: pr });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// OEM RANKING
app.get('/api/v1/oem-ranking', (req, res) => {
  try {
    res.json(OEM_RANKING);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// SECTORS
app.get('/api/v1/metadata/sectors', (req, res) => {
  try {
    res.json(DUTY_SECTORS);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// SERVE WP DEMOS
app.use('/wordpress-assets', express.static(path.join(__dirname, 'wordpress-integration', 'assets')));
app.get('/part-search', (req, res) => {
  res.sendFile(path.join(__dirname, 'wordpress-integration', 'part-search.html'));
});
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'wordpress-integration', 'demo.html'));
});

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error("💥 Error middleware:", err);
  res.status(500).json({ status: "ERROR", message: err.message });
});

// START SERVER
server = app.listen(PORT, '0.0.0.0', () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});

initializeServices();
