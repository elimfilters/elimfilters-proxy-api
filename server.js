/**
 * ELIMFILTERS Proxy API - v2.4.4
 * Estable para Railway
 * - Corrige error ERR_ERL_UNEXPECTED_X_FORWARDED_FOR (trust proxy)  :contentReference[oaicite:1]{index=1}
 * - Evita crash del rate limiter detrás de proxy  :contentReference[oaicite:2]{index=2}
 * - Devuelve errores claros si n8n falla (404 Not Found)  :contentReference[oaicite:3]{index=3}
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Railway está detrás de un proxy y agrega X-Forwarded-For.
 * Si no confiamos en el proxy, express-rate-limit lanza:
 * ERR_ERL_UNEXPECTED_X_FORWARDED_FOR  :contentReference[oaicite:4]{index=4}
 * Esto lo arreglamos habilitando trust proxy ANTES de configurar el rate limit.
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
 * Límite de requests por IP.
 * Con trust proxy activo, ya no truena el limiter.  :contentReference[oaicite:5]{index=5}
 */
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests',
    error_code: 'RATE_LIMIT'
  }
}));

/**
 * Healthcheck
 */
app.get(['/health', '/healthz'], (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '2.4.4',
    endpoints: {
      health: 'GET /health',
      lookup: 'POST /api/v1/filters/lookup',
      chat: 'POST /chat'
    }
  });
});

/**
 * Raíz
 */
app.get('/', (_req, res) => {
  res.redirect('/health');
});

/**
 * Lookup principal
 *
 * Entrada esperada (desde WordPress o Postman):
 * {
 *   "code": "LF3000"
 * }
 *
 * El servidor acepta varias llaves para flexibilidad:
 *  - code
 *  - query
 *  - sku
 *  - oem
 *
 * Envía ese valor a n8n como { query: "LF3000" }.
 * n8n debe buscar en tu Sheet Master por:
 *  - SKU
 *  - OEM_CODES
 *  - CROSS_REFERENCE
 *
 * Luego n8n responde con los datos del filtro.
 * Nota importante: en los logs se vio que tu n8n respondió 404 Not Found,
 * lo que indica que N8N_WEBHOOK_URL no apunta al webhook correcto.  :contentReference[oaicite:6]{index=6}
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

    // Llamar a n8n
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

    // Si n8n devolvió 404 Not Found o similar, reflejar eso
    if (!n8nResponse.ok) {
      const statusText = n8nResponse.statusText || 'Unknown';
      const statusCode = n8nResponse.status;
      console.error('n8n status:', statusCode, statusText); // visto en logs 404 Not Found  :contentReference[oaicite:7]{index=7}

      return res.status(502).json({
        success: false,
        error: 'Upstream n8n error',
        detail: `n8n responded ${statusCode} ${statusText}`,
        error_code: 'N8N_BAD_GATEWAY',
        timestamp: new Date().toISOString()
      });
    }

    const data = await n8nResponse.json();

    // Normalizamos nombres de campos para WordPress
    return res.json({
      success: data.success === true,
      sku: data.sku || data.SKU || null,
      filter_type: data.filter_type || data.FILTER_TYPE || null,
      description: data.description || data.DESCRIPTION || null,
      oem_codes: data.oem_codes || data.OEM_CODES || null,
      cross_reference: data.cross_reference || data.CROSS_REFERENCE || null,
      pdf_url: data.pdf_url || data.PDF_URL || null,

      // raw se deja para depuración en frontend interno mientras pruebas
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
 * Chat de diagnóstico
 * Sirve para probar POST sin pasar por n8n.
 */
app.post('/chat', (req, res) => {
  const msg = req.body?.message || '';
  if (!msg.trim()) {
    return res.status(400).json({
      reply: 'Mensaje requerido'
    });
  }

  return res.json({
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
 * Manejador global de errores
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
 * Arranque del servidor
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ELIMFILTERS Proxy API - v2.4.4`);
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
