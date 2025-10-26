// server.js - ELIMFILTERS Proxy API - rules enforced
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * 1. REGLAS MAESTRAS v2.1.0 (incrustadas)
 * Estas reglas NO se deben borrar ni modificar sin aprobación.
 * Sirven para generar y validar SKUs consistentes.
 */
const RULES = {
  version: '2.1.0',
  allowedChars: /^[A-Za-z0-9\-\s]+$/, // solo letras, números, guión y espacio
  maxLen: 50,                          // no aceptamos códigos ilegales largos
  families: {
    OIL: 'EL8',
    FUEL: 'EF9',
    AIR: 'EA1',
    CABIN: 'EC1',
    HYDRAULIC: 'EH6',
    COOLANT: 'EW7',
    AIR_DRYER: 'ED4'
  }
};

// genera el SKU normalizado interno tipo "EL8-3000"
// baseCode = código que escribió el usuario ("lf3000", "LF-3000", etc.)
// familyHint = categoría opcional del filtro. Por ahora usamos "OIL" por defecto.
function generateNormalizedSKU(baseCode, familyHint = 'OIL') {
  if (!baseCode) return null;

  // 1. limpiar: mayúsculas, sin espacios ni caracteres raros
  const cleaned = String(baseCode)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ''); // quitamos todo excepto A-Z y 0-9

  if (!cleaned) return null;

  // 2. prefijo según familia
  const prefix = RULES.families[familyHint.toUpperCase()] || RULES.families.OIL;

  // 3. últimos 4 dígitos/carácteres significativos
  const last4 = cleaned.slice(-4);

  // 4. SKU normalizado final
  return `${prefix}-${last4}`;
}

// validación básica de entrada del usuario
function validateUserCode(raw) {
  if (!raw) {
    return { ok: false, reason: 'EMPTY' };
  }
  if (raw.length > RULES.maxLen) {
    return { ok: false, reason: 'TOO_LONG' };
  }
  if (!RULES.allowedChars.test(raw)) {
    return { ok: false, reason: 'BAD_CHARS' };
  }
  return { ok: true };
}

/**
 * 2. Seguridad básica y configuración HTTP
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
  windowMs: 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: 'Too many requests',
    error_code: 'RATE_LIMIT'
  }
}));

/**
 * 3. Healthcheck
 */
app.get(['/health', '/healthz'], (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '2.4.2 + rules 2.1.0',
    endpoints: {
      health: 'GET /health',
      lookup: 'POST /api/v1/filters/lookup',
      chat: 'POST /chat'
    },
    rules_version: RULES.version
  });
});

app.get('/', (_req, res) => {
  res.redirect('/health');
});

/**
 * 4. Lookup principal
 * Recibe el código del cliente desde WordPress.
 * Aplica validación y normalización.
 * Llama a n8n con ambos valores:
 *   - raw_code: lo que escribió el cliente
 *   - normalized_sku: SKU interno generado (prefijo + últimos 4)
 * n8n usará esto para buscar en la hoja.
 */
app.post('/api/v1/filters/lookup', async (req, res) => {
  try {
    const incoming =
      req.body?.code ||
      req.body?.query ||
      req.body?.sku ||
      req.body?.oem ||
      '';

    const userCode = String(incoming || '').trim();

    // validar entrada contra las reglas
    const validity = validateUserCode(userCode);
    if (!validity.ok) {
      if (validity.reason === 'EMPTY') {
        return res.status(400).json({
          success: false,
          error: 'code is required',
          error_code: 'MISSING_CODE',
          rules_version: RULES.version,
          timestamp: new Date().toISOString()
        });
      }
      if (validity.reason === 'TOO_LONG') {
        return res.status(400).json({
          success: false,
          error: 'code too long',
          error_code: 'CODE_TOO_LONG',
          maxLen: RULES.maxLen,
          rules_version: RULES.version,
          timestamp: new Date().toISOString()
        });
      }
      if (validity.reason === 'BAD_CHARS') {
        return res.status(400).json({
          success: false,
          error: 'invalid characters',
          error_code: 'INVALID_CHARS',
          allowed: 'A-Z 0-9 - space',
          rules_version: RULES.version,
          timestamp: new Date().toISOString()
        });
      }
      // fallback
      return res.status(400).json({
        success: false,
        error: 'invalid code',
        error_code: 'INVALID_CODE',
        rules_version: RULES.version,
        timestamp: new Date().toISOString()
      });
    }

    // generar SKU normalizado interno (ej. "EL8-3000")
    // por ahora familyHint fijo "OIL". Luego podremos mejorarlo.
    const normalizedSku = generateNormalizedSKU(userCode, 'OIL');

    // si por alguna razón no se pudo generar
    if (!normalizedSku) {
      return res.status(400).json({
        success: false,
        error: 'unable to normalize code',
        error_code: 'NORMALIZATION_FAILED',
        rules_version: RULES.version,
        timestamp: new Date().toISOString()
      });
    }

    // llamada a n8n
    const n8nResp = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.INTERNAL_API_KEY || ''
      },
      body: JSON.stringify({
        raw_code: userCode,          // exactamente lo que entró del usuario
        normalized_sku: normalizedSku, // SKU calculado con reglas
        source: 'elimfilters.com',
        ts: Date.now()
      })
    });

    if (!n8nResp.ok) {
      console.error('n8n status:', n8nResp.status, n8nResp.statusText);
      return res.status(502).json({
        success: false,
        error: 'Upstream n8n error',
        error_code: 'N8N_BAD_GATEWAY',
        rules_version: RULES.version,
        timestamp: new Date().toISOString()
      });
    }

    const data = await n8nResp.json();

    // construir respuesta pública
    // IMPORTANTE:
    // - No forzamos ningún formato aquí.
    // - Lo que llegue en data.* debe venir ya correcto desde n8n
    //   según las reglas: sin contaminar catálogo público.
    return res.json({
      success: data.success === true,
      sku: data.sku || data.SKU || null,
      filter_type: data.filter_type || data.FILTER_TYPE || null,
      description: data.description || data.DESCRIPTION || null,
      oem_codes: data.oem_codes || data.OEM_CODES || null,
      cross_reference: data.cross_reference || data.CROSS_REFERENCE || null,
      pdf_url: data.pdf_url || data.PDF_URL || null,

      // diagnóstico opcional
      rules_version: RULES.version,
      normalized_query_used: normalizedSku,
      raw_query_used: userCode,

      // nunca mostrar raw al usuario final en frontend,
      // pero lo devolvemos aquí para que tú puedas auditar en consola.
      raw: data
    });

  } catch (err) {
    console.error('lookup error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      error_code: 'INTERNAL',
      rules_version: RULES.version,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 5. Chat de diagnóstico opcional
 */
app.post('/chat', (req, res) => {
  const msg = req.body?.message || '';
  if (!msg.trim()) {
    return res.status(400).json({
      reply: 'Mensaje requerido'
    });
  }

  return res.json({
    reply: 'Proxy active',
    echo: msg,
    timestamp: new Date().toISOString()
  });
});

/**
 * 6. Catch-all 404
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    error_code: 'ROUTE_NOT_FOUND',
    path: req.path,
    method: req.method,
    rules_version: RULES.version,
    timestamp: new Date().toISOString(),
    available_routes: {
      health: 'GET /health',
      lookup: 'POST /api/v1/filters/lookup',
      chat: 'POST /chat'
    }
  });
});

/**
 * 7. Error handler
 */
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    error_code: 'INTERNAL',
    rules_version: RULES.version,
    timestamp: new Date().toISOString()
  });
});

/**
 * 8. Start server
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ELIMFILTERS Proxy API with rules ${RULES.version}`);
  console.log(`🚀 Listening on port ${PORT}`);
  console.log(`📊 Health: GET /health`);
  console.log(`🔎 Lookup: POST /api/v1/filters/lookup`);
  console.log(`💬 Chat: POST /chat`);
  console.log(`🌐 n8n webhook: ${process.env.N8N_WEBHOOK_URL}`);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

module.exports = app;
