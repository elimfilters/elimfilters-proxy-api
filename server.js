/**
 * ELIMFILTERS Proxy API - v2.5.0
 * Limpio para producción Railway.
 * - Sin express-rate-limit (se elimina la fuente del error ERR_ERL_UNEXPECTED_X_FORWARDED_FOR).  :contentReference[oaicite:2]{index=2}
 * - Confía en proxy de Railway.
 * - Normaliza respuesta de n8n.
 * - Manejo explícito de error 404 de n8n.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Railway está detrás de un proxy e inyecta X-Forwarded-For.
 * Dejamos trust proxy activo para que req.ip sea consistente.
 */
app.set('trust proxy', 1);

/**
 * Middleware base
 */
app.use(express.json());

app.use(cors({
  origin: [
    'https://elimfilters.com',
    'https://www.elimfilters.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

/**
 * GET /health
 * Devuelve estado vivo del contenedor.
 */
app.get(['/health', '/healthz'], (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '2.5.0',
    endpoints: {
      health: 'GET /health',
      lookup: 'POST /api/v1/filters/lookup',
      chat: 'POST /chat'
    }
  });
});

/**
 * GET /
 * Redirige a /health
 */
app.get('/', (_req, res) => {
  res.redirect('/health');
});

/**
 * POST /api/v1/filters/lookup
 *
 * Entrada aceptada:
 *   { "code": "LF3000" }
 *   { "query": "LF3000" }
 *   { "sku": "LF3000" }
 *   { "oem": "LF3000" }
 *
 * Salida:
 *   {
 *     "success": true,
 *     "sku": "...",
 *     "filter_type": "...",
 *     "description": "...",
 *     "oem_codes": "...",
 *     "cross_reference": "...",
 *     "pdf_url": "...",
 *     "raw": {...}
 *   }
 *
 * Internamente:
 * - Tomamos el valor del cliente.
 * - Llamamos al webhook de n8n (ENV N8N_WEBHOOK_URL).
 * - n8n busca en tu Google Sheet (columnas SKU / OEM_CODES / CROSS_REFERENCE).
 * - Devolvemos datos normalizados para WordPress.
 *
 * Nota: En los logs actuales n8n responde 404 Not Found, lo que indica que
 * N8N_WEBHOOK_URL en Railway está apuntando a un webhook que no existe ya.  :contentReference[oaicite:3]{index=3}
 * Eso no es bug de Node. Es configuración de la variable.
 */
app.post('/api/v1/filters/lookup', async (req, res) => {
  try {
    const codeFromClient =
      req.body?.code ||
      req.body?.query ||
      req.body?.sku ||
      req.body?.oem ||
      '';

    const cleanCode = String(codeFromClient || '').trim();

    if (!cleanCode) {
      return res.status(400).json({
        success: false,
        error: 'code is required',
        error_code: 'MISSING_CODE',
        timestamp: new Date().toISOString()
      });
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({
        success: false,
        error: 'N8N_WEBHOOK_URL not configured in environment',
        error_code: 'MISSING_WEBHOOK_URL',
        timestamp: new Date().toISOString()
      });
    }

    // Llamada al flujo n8n
    const n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.INTERNAL_API_KEY || ''
      },
      body: JSON.stringify({
        query: cleanCode,
        source: 'elimfilters.com',
        ts: Date.now()
      })
    });

    // n8n devolvió 404 en tus logs. Lo manejamos limpio y no tumbamos el proceso.  :contentReference[oaicite:4]{index=4}
    if (!n8nResponse.ok) {
      const statusText = n8nResponse.statusText || 'Unknown';
      const statusCode = n8nResponse.status;

      console.error('n8n status:', statusCode, statusText);

      return res.status(502).json({
        success: false,
        error: 'Upstream n8n error',
        detail: `n8n responded ${statusCode} ${statusText}`,
        error_code: 'N8N_BAD_GATEWAY',
        timestamp: new Date().toISOString()
      });
    }

    const data = await n8nResponse.json();

    // Normalizamos campos para el frontend
    return res.json({
      success: data.success === true,
      sku: data.sku || data.SKU || null,
      filter_type: data.filter_type || data.FILTER_TYPE || null,
      description: data.description || data.DESCRIPTION || null,
      oem_codes: data.oem_codes || data.OEM_CODES || null,
      cross_reference: data.cross_reference || data.CROSS_REFERENCE || null,
      pdf_url: data.pdf_url || data.PDF_URL || null,
      raw: data
    });

  } catch (err) {
    console.error('lookup error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      error_code: 'INTERNAL',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /chat
 * Test rápido local sin n8n.
 */
app.post('/chat', (req, res) => {
  const msg = req.body?.message || '';
  if (!msg.trim()) {
    return res.status(400).json({
      reply: 'Mensaje requerido'
    });
    }
  res.json({
    reply: 'Proxy activo y operativo',
    echo: msg,
    timestamp: new Date().toISOString()
  });
});

/**
 * 404 controlado
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    error_code: 'ROUTE_NOT_FOUND',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_routes: {
      health: 'GET /health',
      lookup: 'POST /api/v1/filters/lookup',
      chat: 'POST /chat'
    }
  });
});

/**
 * Error handler global
 */
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    error_code: 'INTERNAL',
    timestamp: new Date().toISOString()
  });
});

/**
 * Arranque
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ELIMFILTERS Proxy API - v2.5.0`);
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`📊 Health: GET /health`);
  console.log(`🔎 Lookup: POST /api/v1/filters/lookup`);
  console.log(`💬 Chat: POST /chat`);
  console.log(`🌐 N8N Integration: forwarding 'query' to ${process.env.N8N_WEBHOOK_URL}`);
});

/**
 * Shutdown ordenado
 */
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

module.exports = app;
