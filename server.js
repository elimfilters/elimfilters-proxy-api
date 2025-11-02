// =========================================
// ELIMFILTERS Proxy API v3.2.0
// server.js
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
    console.error('❌ Error al inicializar Google Sheets:', err.message);
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
    version: '3.2.0',
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
    console.log(`🔍 Buscando filtro: ${q}`);

    // Paso 1: Buscar en Google Sheets (base de datos)
    let found = null;
    if (sheetsInstance && sheetsInstance.findBySKUorOEM) {
      found = await sheetsInstance.findBySKUorOEM(q);
    }

    // Paso 2: Si no se encuentra, ejecutar detección lógica
    if (!found) {
      console.log('⚙️ No encontrado en base de datos. Ejecutando detección lógica...');
      const detectResult = await detectionService.detectFilter(q);
      return res.json({
        status: 'OK',
        source: 'pattern_detection',
        data: detectResult
      });
    }

    // Paso 3: Devolver datos si se encuentra en Sheets
    console.log(`✅ Coincidencia encontrada en Google Sheets: ${found.sku}`);
    return res.json({
      status: 'OK',
      source: 'database',
      data: found
    });

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
  console.log(`🚀 ELIMFILTERS Proxy API v3.2.0 corriendo en puerto ${PORT}`);
});
