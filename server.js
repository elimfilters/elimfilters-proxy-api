/**
 * ELIMFILTERS Proxy API - v3.0.0
 *
 * - Estable producción Railway
 * - Sin express-rate-limit (evita ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
 * - trust proxy activo
 * - Valida entrada según Reglas Maestras v2.1.0  (OEM Universe / validation / prefixes) :contentReference[oaicite:5]{index=5}
 * - Clasifica la referencia entrante (donaldson, fram, genérico) para trazabilidad interna :contentReference[oaicite:6]{index=6}
 * - Llama a n8n con { query } sin exponer estructura interna
 * - Normaliza SKU público (sin guiones)
 * - Devuelve campos limpios para WordPress
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------------------------------------------------------
// Reglas maestras (versión 2.1.0) embebidas. Estas reglas NO se pierden. :contentReference[oaicite:7]{index=7}
// -----------------------------------------------------------------------------
const MASTER_RULES = {
  version: "2.1.0",
  oem_universe: {
    patterns: {
      donaldson: {
        // ejemplos: P552100, P164378, DBL123 :contentReference[oaicite:8]{index=8}
        primary: [/^P\d{5,6}$/i, /^DBL/i, /^P[0-9]{4,7}$/i],
        fallback: [/^P[0-9]+$/i],
        brand: "DONALDSON",
        duty: "HD"
      },
      fram: {
        // ejemplos: PH8A, CA123, CF456, CH789 :contentReference[oaicite:9]{index=9}
        primary: [/^(PH|CA|CF|CH)\d{3,6}$/i, /^PH[0-9]{1,5}$/i, /^CA[0-9]{3,6}$/i, /^CF[0-9]{3,6}$/i, /^CH[0-9]{3,6}$/i],
        fallback: [],
        brand: "FRAM",
        duty: "LD"
      },
      generic: {
        // ejemplos típicos HD/industrial: LF3620, 1R1808, FF5052 :contentReference[oaicite:10]{index=10}
        primary: [/^[A-Z0-9]{3,10}$/i],
        duty: "any"
      }
    },
    validation: {
      min_length: 3,
      max_length: 10,
      allow_special_chars: ["-", "_", "."],
      must_contain: ["number"],
      normalize_uppercase: true
    }
  },
  rules: {
    // SKU generation: PREFIX-LAST4  → ej: EF9-1234  según mapa de prefijos y los últimos 4 del código base. :contentReference[oaicite:11]{index=11}
    regla_1_sku_generation: true
  },
  prefixes: {
    // familias -> prefijos internos. Ejemplo: FUEL -> EF9, AIR -> EA1, etc. :contentReference[oaicite:12]{index=12}
    ACEITE: "EL8",
    OIL: "EL8",
    COMBUSTIBLE: "EF9",
    FUEL: "EF9",
    SEPARADOR: "EF9",
    SEPARATOR: "EF9",
    AIRE: "EA1",
    AIR: "EA1",
    CABIN: "EC1",
    "CABIN AIR": "EC1",
    AIRE_CABINA: "EC1",
    HYDRAULIC: "EH6",
    HIDRAULICO: "EH6",
    COOLANT: "EW7",
    REFRIGERANTE: "EW7",
    "AIR DRYER": "ED4",
    AIR_DRYER: "ED4",
    KIT_DIESEL: "EK5",
    "KIT DIESEL": "EK5",
    KIT_GAS: "EK3",
    "KIT PASAJEROS": "EK3",
    CARCASA: "EC1",
    HOUSING: "EC1",
    TURBINA: "ET9",
    TURBINE: "ET9"
  }
};

// -----------------------------------------------------------------------------
// Utils internos
// -----------------------------------------------------------------------------

// Limpia el input que manda el cliente y lo normaliza según las reglas.
// Requisitos: longitud entre 3 y 10, debe contener números, mayúsculas forzadas,
// se permiten -, _, .
function normalizeClientQuery(raw) {
  const v = MASTER_RULES.oem_universe.validation;

  if (!raw || typeof raw !== 'string') return { ok: false, reason: 'EMPTY' };

  let q = raw.trim();

  // Forzar mayúsculas si la regla lo exige.
  if (v.normalize_uppercase) {
    q = q.toUpperCase();
  }

  // Validar longitud.
  if (q.length < v.min_length) {
    return { ok: false, reason: 'TOO_SHORT' };
  }
  if (q.length > v.max_length) {
    return { ok: false, reason: 'TOO_LONG' };
  }

  // Validar caracteres permitidos:
  // Permitimos A-Z 0-9 y los special chars listados.
  const allowedSpecial = v.allow_special_chars.join('').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regexAllowed = new RegExp(`^[A-Z0-9${allowedSpecial}]+$`);
  if (!regexAllowed.test(q)) {
    return { ok: false, reason: 'BAD_CHARS' };
  }

  // Debe contener al menos un dígito si "must_contain" incluye "number".
  if (v.must_contain.includes("number")) {
    if (!/[0-9]/.test(q)) {
      return { ok: false, reason: 'NO_NUMBER' };
    }
  }

  return { ok: true, value: q };
}

// Clasifica el código según patrones conocidos (Donaldson, Fram, genérico).
// Uso: logging interno / trazabilidad / priorización futura. :contentReference[oaicite:13]{index=13}
function classifyQuery(q) {
  const { patterns } = MASTER_RULES.oem_universe;

  // Donaldson
  for (const rgx of patterns.donaldson.primary) {
    if (rgx.test(q)) {
      return { brand: patterns.donaldson.brand, duty: patterns.donaldson.duty, family: 'DONALDSON' };
    }
  }
  for (const rgx of patterns.donaldson.fallback) {
    if (rgx.test(q)) {
      return { brand: patterns.donaldson.brand, duty: patterns.donaldson.duty, family: 'DONALDSON' };
    }
  }

  // Fram
  for (const rgx of patterns.fram.primary) {
    if (rgx.test(q)) {
      return { brand: patterns.fram.brand, duty: patterns.fram.duty, family: 'FRAM' };
    }
  }

  // Genérico / HD / industrial
  for (const rgx of patterns.generic.primary) {
    if (rgx.test(q)) {
      return { brand: 'GENERIC', duty: patterns.generic.duty, family: 'GENERIC' };
    }
  }

  // Sin match conocido
  return { brand: 'UNKNOWN', duty: 'any', family: 'UNKNOWN' };
}

// Normaliza SKU para exponerlo al cliente.
// Regla de negocio: no mostrar guiones ni espacios al cliente final.
function publicSkuFrom(rawSku) {
  if (!rawSku) return null;
  return String(rawSku).replace(/[\s-]+/g, '');
}

// Futuro: si un registro viene sin SKU desde n8n pero sí tenemos info técnica,
// podríamos generar un SKU interno con prefijo + últimos 4 dígitos.
// Basado en "regla_1_sku_generation" de las reglas maestras. :contentReference[oaicite:14]{index=14}
function fallbackGeneratedSku(filterTypeText, anyCodeLike) {
  if (!MASTER_RULES.rules.regla_1_sku_generation) return null;
  if (!filterTypeText || !anyCodeLike) return null;

  // Buscar prefijo según familia declarada (ACEITE/OIL -> EL8, FUEL -> EF9, etc.). :contentReference[oaicite:15]{index=15}
  let prefix = null;
  const ftUpper = filterTypeText.toUpperCase();
  for (const [family, pref] of Object.entries(MASTER_RULES.prefixes)) {
    if (ftUpper.includes(family)) {
      prefix = pref;
      break;
    }
  }
  if (!prefix) {
    // fallback a EL8 (aceite) si nada coincide. :contentReference[oaicite:16]{index=16}
    prefix = 'EL8';
  }

  // Tomar últimos 4 dígitos de anyCodeLike.
  const digits = (anyCodeLike.match(/\d+/g) || []).join('');
  if (!digits) return `${prefix}-0000`;
  const last4 = digits.slice(-4).padStart(4, '0');

  return `${prefix}-${last4}`;
}

// -----------------------------------------------------------------------------
// Config Express base
// -----------------------------------------------------------------------------

const appStartTs = Date.now();

app.set('trust proxy', 1);

app.use(express.json());

app.use(cors({
  origin: [
    'https://elimfilters.com',
    'https://www.elimfilters.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// -----------------------------------------------------------------------------
// /health
// -----------------------------------------------------------------------------

app.get(['/health', '/healthz'], (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ELIMFILTERS Proxy API',
    version: '3.0.0',
    uptime_ms: Date.now() - appStartTs,
    rules_version: MASTER_RULES.version,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /health',
      lookup: 'POST /api/v1/filters/lookup',
      chat: 'POST /chat'
    }
  });
});

// raíz -> /health
app.get('/', (_req, res) => {
  res.redirect('/health');
});

// -----------------------------------------------------------------------------
// /api/v1/filters/lookup
// -----------------------------------------------------------------------------

app.post('/api/v1/filters/lookup', async (req, res) => {
  try {
    // 1. Aceptamos múltiples campos de entrada
    const codeFromClient =
      req.body?.code ||
      req.body?.query ||
      req.body?.sku ||
      req.body?.oem ||
      '';

    // 2. Normalizamos según reglas maestras
    const norm = normalizeClientQuery(codeFromClient);
    if (!norm.ok) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_QUERY',
        reason: norm.reason,
        message: 'Input does not meet validation policy',
        rules_version: MASTER_RULES.version,
        timestamp: new Date().toISOString()
      });
    }

    const normalizedQuery = norm.value;

    // 3. Clasificamos el código para trazabilidad
    const classification = classifyQuery(normalizedQuery);

    // 4. Verificamos que la URL del webhook esté configurada
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({
        success: false,
        error: 'MISSING_WEBHOOK_URL',
        message: 'N8N_WEBHOOK_URL not configured',
        rules_version: MASTER_RULES.version,
        timestamp: new Date().toISOString()
      });
    }

    // 5. Llamamos a n8n con el query normalizado
    const n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.INTERNAL_API_KEY || ''
      },
      body: JSON.stringify({
        query: normalizedQuery,
        source: 'elimfilters.com',
        // logging metadata
        duty_hint: classification.duty || null,
        brand_hint: classification.brand || null,
        ts: Date.now()
      })
    });

    if (!n8nResponse.ok) {
      const statusText = n8nResponse.statusText || 'Unknown';
      const statusCode = n8nResponse.status;

      console.error('n8n status:', statusCode, statusText);

      return res.status(502).json({
        success: false,
        error: 'N8N_BAD_GATEWAY',
        detail: `n8n responded ${statusCode} ${statusText}`,
        rules_version: MASTER_RULES.version,
        timestamp: new Date().toISOString()
      });
    }

    // 6. Interpretamos respuesta de n8n
    const data = await n8nResponse.json();

    // sku crudo como viene del sheet
    const rawSku = data.sku || data.SKU || '';

    // sku público ya limpio (sin guiones ni espacios)
    let publicSku = publicSkuFrom(rawSku);

    // fallback: si n8n no trae SKU pero sí trae tipo y refs,
    // generamos un SKU provisional usando prefijo+last4.
    if (!publicSku) {
      const anyRefCode =
        data.CROSS_REFERENCE ||
        data.cross_reference ||
        data.OEM_CODES ||
        data.oem_codes ||
        normalizedQuery;

      const typeGuess =
        data.filter_type ||
        data.FILTER_TYPE ||
        '';

      const fallbackSku = fallbackGeneratedSku(typeGuess, anyRefCode);
      publicSku = fallbackSku ? publicSkuFrom(fallbackSku) : null;
    }

    const filterType =
      data.filter_type ||
      data.FILTER_TYPE ||
      null;

    const description =
      data.description ||
      data.DESCRIPTION ||
      null;

    const oemCodes =
      data.oem_codes ||
      data.OEM_CODES ||
      null;

    const crossRef =
      data.cross_reference ||
      data.CROSS_REFERENCE ||
      null;

    const pdfUrl =
      data.pdf_url ||
      data.PDF_URL ||
      null;

    // 7. Respuesta final estandarizada
    return res.json({
      success: data.success === true,
      sku: publicSku,
      filter_type: filterType,
      description: description,
      oem_codes: oemCodes,
      cross_reference: crossRef,
      pdf_url: pdfUrl,

      // Metadata técnica para auditoría interna / debug
      meta: {
        rules_version: MASTER_RULES.version,
        classification,
        input_original: codeFromClient,
        input_normalized: normalizedQuery,
        rawSku
      }
    });

  } catch (err) {
    console.error('lookup error:', err);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL',
      message: 'Internal Server Error',
      rules_version: MASTER_RULES.version,
      timestamp: new Date().toISOString()
    });
  }
});

// -----------------------------------------------------------------------------
// /chat  (diagnóstico interno simple, no toca n8n)
// -----------------------------------------------------------------------------

app.post('/chat', (req, res) => {
  const msg = req.body?.message || '';
  if (!msg.trim()) {
    return res.status(400).json({
      reply: 'Mensaje requerido',
      rules_version: MASTER_RULES.version
    });
  }

  res.json({
    reply: 'Proxy activo y operativo',
    echo: msg,
    rules_version: MASTER_RULES.version,
    timestamp: new Date().toISOString()
  });
});

// -----------------------------------------------------------------------------
// 404 controlado
// -----------------------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'ROUTE_NOT_FOUND',
    path: req.path,
    method: req.method,
    rules_version: MASTER_RULES.version,
    timestamp: new Date().toISOString(),
    available_routes: {
      health: 'GET /health',
      lookup: 'POST /api/v1/filters/lookup',
      chat: 'POST /chat'
    }
  });
});

// -----------------------------------------------------------------------------
// Error handler global
// -----------------------------------------------------------------------------

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL',
    message: 'Internal Server Error',
    rules_version: MASTER_RULES.version,
    timestamp: new Date().toISOString()
  });
});

// -----------------------------------------------------------------------------
// Arranque
// -----------------------------------------------------------------------------

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ELIMFILTERS Proxy API - v3.0.0`);
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`📊 Health: GET /health`);
  console.log(`🔎 Lookup: POST /api/v1/filters/lookup`);
  console.log(`💬 Chat: POST /chat`);
  console.log(`🌐 N8N Integration: forwarding 'query' to ${process.env.N8N_WEBHOOK_URL}`);
  console.log(`📐 Rules version: ${MASTER_RULES.version} (embedded)`);
});

// Shutdown ordenado
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

module.exports = app;
