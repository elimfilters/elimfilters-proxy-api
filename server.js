/**
 * ELIMFILTERS Proxy API
 * Producción estable en Railway
 * Versión con búsqueda GET /api/v1/filters/search y protección contra caídas
 *
 * Endpoints públicos:
 *   GET  /health
 *   POST /api/v1/filters/lookup
 *   GET  /api/v1/filters/search
 *   POST /chat
 *
 * Motivo técnico:
 * - Railway está detrás de proxy y agrega X-Forwarded-For
 * - express-rate-limit rompe si trust proxy = false
 * - Esta versión fija eso y evita el crash
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch'); // usar ^2.x en package.json
const helmet = require('helmet');

const app = express();

/**
 * Necesario para producción en Railway.
 * Sin esto, express-rate-limit lanza:
 * ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
 * y tumba el contenedor.
 */
app.set('trust proxy', 1);

// Seguridad básica
app.use(helmet());

// CORS y parseo JSON
app.use(cors());
app.use(express.json());

/**
 * Rate limiter defensivo.
 * Protege contra abuso y funciona detrás de proxy.
 */
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60,             // 60 requests/min/IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Con trust proxy activo req.ip ya respeta X-Forwarded-For.
    // Si por alguna razón viene vacío, devolvemos 'unknown'
    return req.ip || 'unknown';
  },
});
app.use(limiter);

/**
 * Extrae el código de búsqueda desde body o querystring.
 * Acepta: code | sku | oem | query
 * Devuelve versión limpia y en mayúsculas.
 */
function buildQueryPayload(req) {
  const candidate =
    (req.body &&
      (req.body.code ||
       req.body.sku ||
       req.body.oem ||
       req.body.query)) ||
    (req.query &&
      (req.query.code ||
       req.query.sku ||
       req.query.oem ||
       req.query.query)) ||
    '';

  const cleaned = String(candidate || '').trim();

  return {
    raw_query_used: candidate || '',
    normalized_query_used: cleaned.toUpperCase(),
  };
}

/**
 * Conecta contra el flujo n8n "elimfilters-search"
 * Este flujo es quien realmente resuelve el catálogo.
 * Si cambias el nombre del flujo en n8n solo cambia
 * la variable de entorno N8N_WEBHOOK_URL en Railway.
 */
async function callN8nSearchService(userQueryInfo) {
  const webhookUrl =
    process.env.N8N_WEBHOOK_URL ||
    'https://elimfilterscross.app.n8n.cloud/webhook/elimfilters-search';

  const payload = {
    query: userQueryInfo.normalized_query_used,
    raw: userQueryInfo.raw_query_used,
    source: 'railway-proxy',
  };

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let parsed;
  try {
    parsed = await resp.json();
  } catch (e) {
    // n8n devolvió texto plano o vacío
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

/**
 * GET /health
 * Responde estado, versión y rutas disponibles.
 * Útil para monitoreo, WP y debugging.
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '2.4.3 + rules 2.1.0',
    endpoints: {
      health: 'GET /health',
      lookup: 'POST /api/v1/filters/lookup',
      search: 'GET /api/v1/filters/search',
      chat: 'POST /chat',
    },
    rules_version: '2.1.0',
  });
});

/**
 * POST /api/v1/filters/lookup
 * Entrada típica de catálogo desde WP/chatbot.
 * Body esperado:
 *   { "code": "LF3000" }
 * También acepta sku, oem o query.
 */
app.post('/api/v1/filters/lookup', async (req, res) => {
  try {
    const queryInfo = buildQueryPayload(req);
    const n8nResult = await callN8nSearchService(queryInfo);

    res.status(n8nResult.status || 200).json({
      success: n8nResult.ok,
      ...queryInfo,
      source: 'POST /api/v1/filters/lookup',
      data: n8nResult.n8n_response || null,
    });
  } catch (err) {
    console.error('lookup error', err);
    res.status(500).json({
      success: false,
      source: 'POST /api/v1/filters/lookup',
      error: 'Lookup internal error',
    });
  }
});

/**
 * GET /api/v1/filters/search
 * Esta ruta existe para tu nodo n8n
 * "HTTP – Railway API Fallback".
 * Ejemplos válidos:
 *   /api/v1/filters/search?code=LF3000
 *   /api/v1/filters/search?sku=EL82100
 *   /api/v1/filters/search?oem=P552100
 *   /api/v1/filters/search?query=P552100
 */
app.get('/api/v1/filters/search', async (req, res) => {
  try {
    const queryInfo = buildQueryPayload(req);
    const n8nResult = await callN8nSearchService(queryInfo);

    res.status(n8nResult.status || 200).json({
      success: n8nResult.ok,
      ...queryInfo,
      source: 'GET /api/v1/filters/search',
      data: n8nResult.n8n_response || null,
    });
  } catch (err) {
    console.error('search error', err);
    res.status(500).json({
      success: false,
      source: 'GET /api/v1/filters/search',
      error: 'Search internal error',
    });
  }
});

/**
 * POST /chat
 * Hook para mensajería (WhatsApp, webchat).
 * Por ahora hace eco.
 * Body esperado:
 *   { "message": "..." }
 */
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        error: 'message requerido',
      });
    }

    res.json({
      success: true,
      echo: message,
      note: 'Ruta /chat operativa.',
    });
  } catch (err) {
    console.error('chat error', err);
    res.status(500).json({
      success: false,
      source: 'POST /chat',
      error: 'Chat internal error',
    });
  }
});

/**
 * Arranque del servidor.
 * Railway inyecta PORT en runtime.
 * En local usa 3000.
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ ELIMFILTERS Proxy API with rules 2.1.0');
  console.log(`🚀 Listening on port ${PORT}`);
  console.log('📊 Health: GET /health');
  console.log('🔎 Lookup: POST /api/v1/filters/lookup');
  console.log('🔍 Search: GET /api/v1/filters/search');
  console.log('💬 Chat: POST /chat');
  console.log(
    '🌐 n8n webhook:',
    process.env.N8N_WEBHOOK_URL ||
      'https://elimfilterscross.app.n8n.cloud/webhook/elimfilters-search'
  );
});
