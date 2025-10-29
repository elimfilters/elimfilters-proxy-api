// server.js — ELIMFILTERS Proxy API v3.0.0 (sin IA ni n8n)
// =======================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');
const { processFilterCode } = require('./filterProcessor');
const rulesProtection = require('./rulesProtection');
const security = require('./security');

const app = express();

// -------------------------------------
// Configuración general
// -------------------------------------
app.set('trust proxy', 1);

app.use(cors({
  origin: [
    'https://elimfilters.com',
    'https://www.elimfilters.com',
  ],
  methods: ['GET', 'POST'],
}));

app.use(express.json());

// Rate limit: 30 requests por minuto por IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// -------------------------------------
// Inicialización de servicios
// -------------------------------------
let sheetsInstance;

async function initializeServices() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    detectionService.setSheetsInstance(sheetsInstance);
    console.log('✅ Google Sheets Service inicializado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando Google Sheets:', error.message);
  }
}
initializeServices();

// -------------------------------------
// Endpoints
// -------------------------------------

// Verificación de estado
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'elimfilters-proxy-api',
    version: '3.0.0',
    rules_version: '2.2.3',
    timestamp: new Date().toISOString(),
  });
});

// Endpoint principal: detección de filtros
app.post('/api/detect-filter', security.verifyKey, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ error: 'Query vacía o inválida' });
    }

    const result = await processFilterCode(query, { sheetsInstance });
    res.json(result);
  } catch (error) {
    console.error('❌ Error procesando /api/detect-filter:', error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
});

// Endpoint protegido: reglas maestras (solo interno)
app.get('/api/rules', security.verifyKey, (req, res) => {
  const rules = rulesProtection.getRulesMetadata();
  res.status(200).json(rules);
});

// -------------------------------------
// Manejo de errores
// -------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// -------------------------------------
// Inicio del servidor
// -------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 ELIMFILTERS Proxy API v3.0.0 ejecutándose en puerto ${PORT}`);
});

