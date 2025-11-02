// =========================================
// ELIMFILTERS Proxy API v3.2.1
// =========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');

const app = express();
const PORT = process.env.PORT || 3000;

// =======================
// CONFIGURACIÓN GLOBAL
// =======================
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { status: 'ERROR', message: 'Too many requests' }
}));

let sheetsInstance = null;

// =======================
// INICIALIZAR GOOGLE SHEETS
// =======================
async function initializeSheets() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    detectionService.setSheetsInstance(sheetsInstance);
    console.log('✅ Google Sheets y Detection Service inicializados correctamente');
  } catch (err) {
    console.error('❌ Error inicializando Google Sheets:', err.message);
  }
}
initializeSheets();

// =======================
// ENDPOINT /health
// =======================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '3.2.1',
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter'
    }
  });
});

// =======================
// ENDPOINT /api/detect-filter
// =======================
app.post('/api/detect-filter', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || query.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Query required' });
    }

    const q = query.trim().toUpperCase();
    console.log(`🔍 Detectando filtro: ${q}`);

    const detectResult = await detectionService.detectFilter(q);
    res.json({ status: 'OK', ...detectResult });

  } catch (error) {
    console.error('❌ Error en /api/detect-filter:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Fallo interno en detect-filter',
      details: error.message || null
    });
  }
});

// =======================
// SERVIDOR ACTIVO
// =======================
app.listen(PORT, () => {
  console.log(`🚀 ELIMFILTERS Proxy API v3.2.1 corriendo en puerto ${PORT}`);
});
