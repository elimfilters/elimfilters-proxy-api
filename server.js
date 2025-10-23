/**
 * server.js - v2.1.0 ACTUALIZADO
 * 
 * CAMBIOS:
 * 1. Importar UniverseValidator
 * 2. Cargar REGLAS_MAESTRAS.json con oem_universe
 * 3. Pasar RULES_MASTER a businessLogic
 * 4. Agregar 3 nuevos endpoints:
 *    - POST /api/v1/validate-oem
 *    - GET /api/v1/oem-universe
 *    - POST /api/v1/normalize-codes
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
const UniverseValidator = require('./universeValidator');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// CARGAR REGLAS_MAESTRAS.json (v2.1.0 con oem_universe)
// ============================================================================
let RULES_MASTER = null;

function loadRulesMaster() {
  try {
    // Buscar en diferentes localizaciones posibles
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
        
        // Verificar que tiene oem_universe
        if (!RULES_MASTER.oem_universe) {
          console.warn('⚠️  REGLAS_MAESTRAS.json NO tiene sección oem_universe. Actualizar a v2.1.0');
        }
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
    oem_universe_enabled: !!(RULES_MASTER?.oem_universe),
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
// NUEVO: 3 Endpoints para OEM Universe v2.1.0
// ============================================================================

/**
 * NUEVO ENDPOINT 1: POST /api/v1/validate-oem
 * Valida múltiples OEM codes contra patterns del universo
 */
app.post('/api/v1/validate-oem', (req, res) => {
  try {
    if (!RULES_MASTER || !RULES_MASTER.oem_universe) {
      return res.status(503).json({
        success: false,
        error: 'OEM_UNIVERSE_NOT_LOADED',
        message: 'Actualizar REGLAS_MAESTRAS.json a v2.1.0'
      });
    }

    const { codes } = req.body;
    if (!codes) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CODES',
        message: 'Required field: codes'
      });
    }

    const validator = new UniverseValidator(RULES_MASTER);
    const result = validator.validate(codes);

    return res.json({
      success: true,
      version: RULES_MASTER.version,
      data: result
    });
  } catch (e) {
    console.error('❌ Error validating OEM codes:', e);
    return res.status(500).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: e.message
    });
  }
});

/**
 * NUEVO ENDPOINT 2: GET /api/v1/oem-universe
 * Retorna configuración completa del universo
 */
app.get('/api/v1/oem-universe', (req, res) => {
  try {
    if (!RULES_MASTER || !RULES_MASTER.oem_universe) {
      return res.status(503).json({
        success: false,
        error: 'OEM_UNIVERSE_NOT_LOADED'
      });
    }

    const validator = new UniverseValidator(RULES_MASTER);
    const universe = validator.getUniverse();

    return res.json({
      success: true,
      version: RULES_MASTER.version,
      data: universe
    });
  } catch (e) {
    console.error('❌ Error getting OEM universe:', e);
    return res.status(500).json({
      success: false,
      error: 'UNIVERSE_ERROR',
      message: e.message
    });
  }
});

/**
 * NUEVO ENDPOINT 3: POST /api/v1/normalize-codes
 * Normaliza múltiples códigos OEM en diferentes formatos
 */
app.post('/api/v1/normalize-codes', (req, res) => {
  try {
    if (!RULES_MASTER || !RULES_MASTER.oem_universe) {
      return res.status(503).json({
        success: false,
        error: 'OEM_UNIVERSE_NOT_LOADED'
      });
    }

    const { codes } = req.body;
    if (!codes) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CODES',
        message: 'Required field: codes'
      });
    }

    const validator = new UniverseValidator(RULES_MASTER);
    const normalized = validator.normalize(codes);

    return res.json({
      success: true,
      normalized,
      count: normalized.length,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('❌ Error normalizing codes:', e);
    return res.status(500).json({
      success: false,
      error: 'NORMALIZATION_ERROR',
      message: e.message
    });
  }
});

// ============================================================================
// Endpoints existentes (compatibilidad)
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
 * REST endpoint usado por chatbot
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
app.get('/api/products', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success: false, error: 'Service unavailable' });
    const query = req.query.q || '';
    const products = await sheetsInstance.searchProducts(query);
    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ success: false, error: 'Error fetching products' });
  }
});

app.get('/api/products/:sku', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success: false, error: 'Service unavailable' });
    const { sku } = req.params;
    const products = await sheetsInstance.searchProducts(sku);
    if (products.length === 0) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: products[0] });
  } catch (error) {
    console.error('❌ Error fetching product:', error);
    res.status(500).json({ success: false, error: 'Error fetching product' });
  }
});

app.post('/api/detect-filter', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success: false, error: 'Service unavailable' });
    const { query } = req.body;
    if (!query || query.trim() === '') return res.status(400).json({ success: false, error: 'Query required' });
    const result = await detectionService.detectFilter(query);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Error detecting filter:', error);
    res.status(500).json({ success: false, error: 'Error detecting filter' });
  }
});

app.post('/api/generate-sku', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success: false, error: 'Service unavailable' });
    const { filterType, family, specs, oemCodes, crossReference, rawData } = req.body;
    if (!filterType || !family || !rawData) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields',
        message: 'Required: filterType, family, rawData'
      });
    }

    // ✅ ACTUALIZADO: generateSKU retorna detalles de universo
    const result = businessLogic.generateSKU(family, rawData.duty_level, specs || {}, oemCodes || [], crossReference || [], rawData);
    
    res.json({
      success: true,
      data: {
        sku: result.sku,
        filterType,
        family,
        dutyLevel: rawData.duty_level,
        timestamp: new Date().toISOString(),
        universeDetails: result.universeDetails || {}
      }
    });
  } catch (error) {
    console.error('❌ Error generating SKU:', error);
    res.status(500).json({ success: false, error: 'Error generating SKU', message: error.message });
  }
});

app.post('/api/process-filter', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success: false, error: 'Service unavailable' });
    const { family, specs, oemCodes, crossReference, rawData } = req.body;
    if (!family || !rawData) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields',
        message: 'Required: family, rawData'
      });
    }

    const processedData = businessLogic.processFilterData(family, specs || {}, oemCodes || [], crossReference || [], rawData);
    res.json({ success: true, data: processedData });
  } catch (error) {
    console.error('❌ Error processing filter data:', error);
    res.status(500).json({ success: false, error: 'Error processing filter data' });
  }
});

// ============================================================================
// Error handlers
// ============================================================================
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
});

// ============================================================================
// START SERVER
// ============================================================================
async function safeInit() {
  loadRulesMaster();

  if (process.env.SKIP_SHEETS_INIT === 'true') {
    console.warn('⚠️  SKIP_SHEETS_INIT=true → Google Sheets disabled');
    return;
  }
  
  try {
    await initializeServices();
  } catch (e) {
    console.error('⚠️  Sheets init FAILED. Server up. Reason:', e?.message);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on port ${PORT}`);
  console.log(`📊 Health: GET /health`);
  console.log(`🔄 Proxy:  POST /api/v1/filters/search → ${N8N_URL || 'MISSING'}`);
  console.log(`🌍 OEM Universe: GET /api/v1/oem-universe`);
  console.log(`✔️  Validate: POST /api/v1/validate-oem`);
  console.log(`⚙️  Normalize: POST /api/v1/normalize-codes`);
  safeInit();
});

process.on('SIGTERM', () => {
  console.log('✅ SIGTERM received');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('✅ SIGINT received');
  process.exit(0);
});

module.exports = app;
