require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');
const { processFilterCode } = require('./filterProcessor');

const app = express();

// Confiar en proxy (Railway)
app.set('trust proxy', 1);

// CORS limitado a los dominios públicos de ELIMFILTERS
app.use(cors({
  origin: [
    'https://elimfilters.com',
    'https://www.elimfilters.com'
  ],
  methods: ['GET','POST'],
}));

// Body parser JSON
app.use(express.json());

// Rate limiting básico para /api/*
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30,             // 30 req/min por IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ===============================
// Inicialización de servicios
// ===============================
let sheetsInstance;

async function initServices() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    detectionService.setSheetsInstance(sheetsInstance);
    console.log('[INIT] Google Sheets listo');
  } catch (err) {
    console.error('[INIT ERROR] No se pudo inicializar Google Sheets:', err.message);
  }
}
initServices();

// ===============================
// /health
// ===============================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '3.0.0',
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter',
    },
  });
});

// ===============================
// /api/detect-filter
// Esta es la ruta oficial que usará WordPress
// ===============================
app.post('/api/detect-filter', async (req, res) => {
  // Aceptar distintos nombres de campo por compatibilidad
  const candidate =
    (req.body && (req.body.code || req.body.sku || req.body.oem || req.body.query)) ||
    (req.query && (req.query.code || req.query.sku || req.query.oem || req.query.query)) ||
    '';

  const normalized = String(candidate || '').trim().toUpperCase();

  if (!normalized) {
    return res.status(400).json({
      status: 'ERROR',
      message: 'Falta código de búsqueda (query vacío)',
    });
  }

  try {
    // Lógica central interna
    // processFilterCode debe aplicar:
    //  - normalización
    //  - lookup en Google Sheets / DB
    //  - reglas de familia / duty
    //  - generación SKU oficial
    //  - construcción de respuesta final
    const result = await processFilterCode(normalized);

    // Si el pipeline interno ya construye respuesta estándar,
    // la exponemos tal cual con status OK.
    return res.status(200).json({
      status: 'OK',
      ...result,
    });

  } catch (err) {
    console.error('[DETECT-FILTER] ERROR:', err);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Fallo interno en detect-filter',
      details: err.message || null,
    });
  }
});

// ===============================
// Manejador de errores global
// ===============================
app.use((err, req, res, next) => {
  console.error('[ERROR GLOBAL]:', err);
  res.status(500).json({
    status: 'ERROR',
    message: err.message || 'Internal server error',
  });
});

// ===============================
// Arranque servidor
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ ELIMFILTERS Proxy API v3.0.0');
  console.log('🔒 Reglas v2.2.3 protegidas | Sin n8n');
  console.log(`🚀 Listening on port ${PORT}`);
  console.log('📊 Health: GET /health');
  console.log('🔎 Detect: POST /api/detect-filter');
});
