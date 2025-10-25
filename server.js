/**
 * ELIMFILTERS Proxy API - v2.4.3
 * Estable y funcional para Railway
 * Corrige ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
 * Valida conexión n8n y normaliza respuesta
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Necesario en Railway (soluciona ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
app.set('trust proxy', 1);

/**
 * Seguridad y configuración básica
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

app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 50,
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
    version: '2.4.3',
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
app.get('/', (_req, res) => res.redirect('/health'));

/**
 * Endpoint principal /api/v1/filters/lookup
 * - Recibe código de búsqueda desde WordPress o Postman
 * - Envía a n8n vía webhook
 * - Retorna resultado limpio y normalizado
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

    // Llamada al flujo n8n configurado
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({
        success: false,
        error: 'N8N_WEBHOOK_URL not configured in environment',
        error_code: 'MISSING_WEBHOOK_URL'
      });
    }

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

    if (!n8nResponse.ok) {
      console.error('n8n status:', n8nResponse.status, n8nResponse.statusText);
      return res.status(502).json({
        success: false,
        error: 'Upstream n8n error',
        error_code: 'N8N_BAD_GATEWAY',
        timestamp: new Date().toISOString()
      });
    }

    const data = await n8nResponse.json();

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
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      error_code: 'INTERNAL',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Chat de diagnóstico
 */
app.post('/chat', (req, res) => {
  const msg = req.body?.message || '';
  if (!msg.trim()) {
    return res.status(400).json({ reply: 'Mensaje requerido' });
  }

  res.json({
    reply: 'Proxy activo y operativo',
    echo: msg,
    timestamp: new Date().toISOString()
  });
});

/**
 * Controlador 404
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
 * Manejador de errores global
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
 * Inicialización
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ELIMFILTERS Proxy API - v2.4.3`);
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`📊 Health: GET /health`);
  console.log(`🔎 Lookup: POST /api/v1/filters/lookup`);
  console.log(`💬 Chat: POST /chat`);
  console.log(`🌐 N8N Integration: forwarding 'query' to ${process.env.N8N_WEBHOOK_URL}`);
});

/**
 * Apagado limpio
 */
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

module.exports = app;
