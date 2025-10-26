require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();

// Trust proxy - necesario en Railway
app.set('trust proxy', 1);

// CORS y JSON
app.use(cors());
app.use(express.json());

// Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
});
app.use(limiter);

// Normaliza input del cliente
function buildQueryPayload(req) {
  const candidate =
    (req.body && (req.body.code || req.body.sku || req.body.oem || req.body.query)) ||
    (req.query && (req.query.code || req.query.sku || req.query.oem || req.query.query)) ||
    '';

  const cleaned = String(candidate || '').trim();

  return {
    raw_query_used: candidate || '',
    normalized_query_used: cleaned.toUpperCase(),
  };
}

// Conecta con n8n
async function callN8nSearchService(userQueryInfo) {
  const webhookUrl =
    process.env.N8N_WEBHOOK_URL ||
    'https://elimfilterscross.app.n8n.cloud/webhook/elimfilters-search';

  const payload = {
    code: userQueryInfo.normalized_query_used, // CAMBIO: usar "code" en lugar de "query"
    raw: userQueryInfo.raw_query_used,
    source: 'railway-proxy',
  };

  console.log(`[RAILWAY] Llamando a n8n: ${webhookUrl}`);
  console.log(`[RAILWAY] Payload:`, JSON.stringify(payload));

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: 30000, // 30 segundos timeout
  });

  let parsed;
  try {
    parsed = await resp.json();
  } catch (err) {
    console.error('[RAILWAY] Error parsing n8n response:', err);
    parsed = {
      error: true,
      message: 'Respuesta no es JSON válido desde n8n',
      statusCode: resp.status,
    };
  }

  return {
    status: resp.status,
    ok: resp.ok,
    n8n_response: parsed,
  };
}

// GET /health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '2.4.0',
    endpoints: {
      health: 'GET /health',
      lookup: 'POST /api/v1/filters/lookup',
      search: 'GET /api/v1/filters/search',
    },
  });
});

// POST /api/v1/filters/lookup
app.post('/api/v1/filters/lookup', async (req, res) => {
  try {
    console.log('[LOOKUP] Request body:', req.body);
    const queryInfo = buildQueryPayload(req);
    
    if (!queryInfo.normalized_query_used) {
      return res.status(400).json({
        success: false,
        error: 'Código requerido',
        message: 'Debes enviar code, sku, oem o query',
      });
    }

    const n8nResult = await callN8nSearchService(queryInfo);

    res.status(n8nResult.status || 200).json({
      success: n8nResult.ok,
      ...queryInfo,
      source: 'POST /api/v1/filters/lookup',
      data: n8nResult.n8n_response || null,
    });
  } catch (err) {
    console.error('[LOOKUP] Error:', err);
    res.status(500).json({
      success: false,
      source: 'POST /api/v1/filters/lookup',
      error: err.message || 'Lookup internal error',
    });
  }
});

// GET /api/v1/filters/search
app.get('/api/v1/filters/search', async (req, res) => {
  try {
    console.log('[SEARCH] Query params:', req.query);
    const queryInfo = buildQueryPayload(req);
    
    if (!queryInfo.normalized_query_used) {
      return res.status(400).json({
        success: false,
        error: 'Código requerido',
        message: 'Debes enviar code, sku, oem o query como query parameter',
      });
    }

    const n8nResult = await callN8nSearchService(queryInfo);

    res.status(n8nResult.status || 200).json({
      success: n8nResult.ok,
      ...queryInfo,
      source: 'GET /api/v1/filters/search',
      data: n8nResult.n8n_response || null,
    });
  } catch (err) {
    console.error('[SEARCH] Error:', err);
    res.status(500).json({
      success: false,
      source: 'GET /api/v1/filters/search',
      error: err.message || 'Search internal error',
    });
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('[ERROR GLOBAL]:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
});

// Arranque servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ ELIMFILTERS Proxy API v2.4.0');
  console.log(`🚀 Listening on port ${PORT}`);
  console.log('📊 Health: GET /health');
  console.log('🔎 Lookup: POST /api/v1/filters/lookup');
  console.log('🔍 Search: GET /api/v1/filters/search');
  console.log(
    '🌐 n8n webhook:',
    process.env.N8N_WEBHOOK_URL ||
      'https://elimfilterscross.app.n8n.cloud/webhook/elimfilters-search'
  );
});
