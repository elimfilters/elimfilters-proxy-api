/**
 * server.js - v2.2.0 LIMPIO
 * 
 * ✅ ELIMINADA dependencia rota: universeValidator
 * ✅ ELIMINADOS endpoints que dependían de UniverseValidator
 * ✅ MANTIENE funcionalidad core 100% operativa
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');
const businessLogic = require('./businessLogic');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// CARGAR REGLAS_MAESTRAS.json
// ============================================================================
let RULES_MASTER = null;

function loadRulesMaster() {
  try {
    const possiblePaths = [
      path.join(__dirname, 'config', 'REGLAS_MAESTRAS.json'),
      path.join(__dirname, 'REGLAS_MAESTRAS.json'),
      process.env.RULES_MASTER_PATH
    ].filter(Boolean);

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        RULES_MASTER = JSON.parse(content);
        console.log(`✅ REGLAS_MAESTRAS.json cargado desde: ${filePath} (v${RULES_MASTER.version})`);
        return;
      }
    }

    console.warn('⚠️  REGLAS_MAESTRAS.json no encontrado. Usando fallback.');
    RULES_MASTER = { version: '1.0.0', prefixes: {}, rules: {} };
  } catch (e) {
    console.error(`❌ Error cargando REGLAS_MAESTRAS.json: ${e.message}`);
    RULES_MASTER = { version: '1.0.0', prefixes: {}, rules: {} };
  }
}

// ============================================================================
// CORS
// ============================================================================
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://elimfilters.com,https://www.elimfilters.com')
  .split(',').map(s => s.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(express.json({ limit: '1mb' }));

// ============================================================================
// N8N URL
// ============================================================================
const N8N_URL =
  process.env.N8N_WEBHOOK_URL ||
  process.env.N8N_URL_PRIMARY ||
  process.env.N8N_URL_FALLBACK;

// ============================================================================
// Google Sheets (opcional)
// ============================================================================
let sheetsInstance;

async function initializeServices() {
  sheetsInstance = new GoogleSheetsService();
  await sheetsInstance.initialize();
  detectionService.setSheetsInstance(sheetsInstance);
  
  // Pasar RULES_MASTER a businessLogic
  businessLogic.setRulesMaster(RULES_MASTER);
  
  console.log('✅ Services initialized');
}

// ============================================================================
// Health Checks
// ============================================================================
app.get('/healthz', (_req, res) => res.send('ok'));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: RULES_MASTER?.version || 'unknown',
    sheetsConnected: !!sheetsInstance,
    n8nUrlConfigured: !!N8N_URL,
    rulesLoaded: !!RULES_MASTER
  });
});

app.get('/', (_req, res) => res.redirect('/health'));

// ============================================================================
// Helper: Forward to N8N
// ============================================================================
async function forwardToN8N(query, extra = {}) {
  if (!N8N_URL) return { ok: false, status: 503, body: { reply: 'Service unavailable' } };
  
  const payload = {
    body: { source: 'web', query },
    headers: extra.headers || {},
    meta: { sessionId: extra.sessionId || 'anon', origin: extra.origin || '' }
  };
  
  const r = await fetch(N8N_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: 15000
  });
  
  const text = await r.text().catch(() => '');
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  
  return { ok: r.ok, status: r.status, body: json };
}

// ============================================================================
// Endpoints principales
// ============================================================================

/**
 * Chat endpoint simple
 */
app.post('/chat', async (req, res) => {
  try {
    const message = req.body?.message || req.body?.text || req.body?.content || '';
    const sessionId = req.body?.sessionId || req.body?.session_id || 'anon';
    if (!message.trim()) return res.status(400).json({ reply: 'Ingrese un código válido.' });

    const fx = await forwardToN8N(message, { sessionId, origin: req.headers.origin });
    if (!fx.ok) return res.status(502).json({ reply: 'Error de conexión. Intente nuevamente.' });

    const b = fx.body || {};
    const reply = b.message || (b.filter ? `${b.filter.filter_type || 'FILTER'} (${b.filter.sku || 'N/A'})` : 'Sin datos');
    return res.json({ reply, raw: b });
  } catch (e) {
    console.error('❌ Proxy /chat error:', e);
    return res.status(502).json({ reply: 'Error de conexión. Intente nuevamente.' });
  }
});

/**
 * REST endpoint usado por chatbot y WP
 */
app.post('/api/v1/filters/search', async (req, res) => {
  try {
    const q =
      req.body?.body?.query ||
      req.body?.query ||
      req.body?.q ||
      req.body?.message ||
      '';
    const sessionId = req.body?.sessionId || 'anon';
    if (!q.trim()) return res.status(400).json({ success: false, error: 'Query required' });

    const fx = await forwardToN8N(q, { sessionId, origin: req.headers.origin });
    return res.status(fx.status).json(fx.body);
  } catch (e) {
    console.error('❌ Proxy /api/v1/filters/search error:', e);
    return res.status(502).json({ success: false, error: 'proxy_failed' });
  }
});

/**
 * APIs existentes (Sheets opcional)
 */
app.get('/api/products', async (req, res) =>
