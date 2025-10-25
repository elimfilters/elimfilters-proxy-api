require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Seguridad básica y configuración
 */
app.use(express.json());

app.use(cors({
  origin: [
    'https://elimfilters.com',
    'https://www.elimfilters.com'
  ],
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(rateLimit({
  windowMs: 60 * 1000,          // 1 minuto
  max: 50,                      // 50 req/min por IP
  message: {
    success: false,
    error: 'Too many requests',
    error_code: 'RATE_LIMIT'
  }
}));

/**
 * Healthcheck público
 * Útil para monitoreo y para confirmar que el contenedor está vivo.
 */
app.get(['/health', '/healthz'], (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '2.4.2',
    endpoints: {
      health: 'GET /health',
      lookup: 'POST /api/v1/filters/lookup',
      chat: 'POST /chat'
    }
  });
});

/**
 * Raíz redirige a /health
 */
app.get('/', (_req, res) => {
  res.redirect('/health');
});

/**
 * Lookup principal:
 * WordPress manda un código de parte o referencia del cliente.
 * Este servidor:
 *   - limpia ese valor
 *   - lo reenvía a n8n como { query: "valor" }
 *   - recibe datos del Sheet Master procesados por n8n
 *   - devuelve una respuesta limpia a WordPress
 *
 * No requiere cambiar tu Sheet Master.
 */
app.post('/api/v1/filters/lookup', async (req, res) => {
  try {
    // Aceptamos diferentes llaves para ser compatibles con front actual y futuro
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

    // Llamamos al workflow de n8n
    // n8n se encargará de buscar este valor en SKU / OEM_CODES / CROSS_REFERENCE
    const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.INTERNAL_API_KEY || ''
      },
      body: JSON.stringify({
        query: cleanCode,          // la API interna siempre manda "query"
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

    // data es lo que devuelve n8n. Ejemplo esperado desde n8n:
    // {
    //   "success": true,
    //   "SKU": "ELIM-LF3000",
    //   "FILTER_TYPE": "Lube Oil Filter",
    //   "CROSS_REFERENCE": "Donaldson P550371; Baldwin BD103",
    //   "OEM_CODES": "Cummins 3318853; Fleetguard LF3000",
    //   "DESCRIPTION": "High efficiency oil filter...",
    //   "PDF_URL": "https://elimfilters.com/.../ELIM-LF3000-spec.pdf"
    // }

    // Normalizamos nombres para el frontend WordPress
    return res.json({
      success: data.success === true,
      sku: data.sku || data.SKU || null,
      filter_type: data.filter_type || data.FILTER_TYPE || null,
      description: data.description || data.DESCRIPTION || null,
      oem_codes: data.oem_codes || data.OEM_CODES || null,
      cross_reference: data.cross_reference || data.CROSS_REFERENCE || null,
      pdf_url: data.pdf_url || data.PDF_URL || null,

      // raw se deja para debugging / validación, no lo uses en UI pública
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
 * Chat endpoint opcional de diagnóstico rápido
 * No afecta la búsqueda pero te permite probar conectividad externa con POST.
 */
app.post('/chat', (req, res) => {
  const msg = req.body?.message || '';
  if (!msg.trim()) {
    return res.status(400).json({
      reply: 'Mensaje requerido'
    });
  }

  return res.json({
    reply: 'Proxy activo',
    echo: msg,
    timestamp: new Date().toISOString()
  });
});

/**
 * Catch-all 404 controlado
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
 * Error handler de seguridad
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
 * Iniciar servidor
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ELIMFILTERS Proxy API - v2.4.2`);
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
