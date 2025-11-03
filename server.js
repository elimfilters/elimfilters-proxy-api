// =========================================
// server.js v4.1 — ELIMFILTERS Proxy API
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

// ----------------------
// Seguridad y CORS
// ----------------------
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { status: 'ERROR', message: 'Too many requests' }
}));

let sheetsInstance;

// ----------------------
// Inicialización Google Sheets
// ----------------------
async function initializeSheets() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    console.log('✅ Google Sheets conectado correctamente');
  } catch (err) {
    console.error('❌ Error al inicializar Sheets:', err.message);
  }
}
initializeSheets();

// ----------------------
// Health Check
// ----------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '4.1',
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter'
    }
  });
});

// ----------------------
// Endpoint principal
// ----------------------
app.post('/api/detect-filter', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || query.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Query required' });
    }

    const q = query.trim().toUpperCase();
    console.log(`🔍 Detectando filtro: ${q}`);

    if (!sheetsInstance) {
      return res.status(500).json({ status: 'ERROR', message: 'Sheets not initialized' });
    }

    // Paso 1 — Buscar si ya existe en la hoja Master
    const found = await sheetsInstance.findRowByQuery(q);
    if (found) {
      console.log(`✅ Encontrado en hoja Master: ${found.sku}`);
      return res.json({
        status: 'OK',
        source: 'Master',
        data: found
      });
    }

    // Paso 2 — Si no existe, generar usando detectionService
    console.log('⚙️ No encontrado, ejecutando generación lógica...');
    const generated = detectionService.detectFilter(q);

    // Guardar en la hoja (nueva fila)
    await sheetsInstance.appendRow(generated);

    console.log(`✅ Nuevo SKU generado: ${generated.final_sku}`);
    return res.json({
      status: 'OK',
      source: 'Generated',
      data: generated
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

// ----------------------
// Servidor activo
// ----------------------
app.listen(PORT, () => {
  console.log(`🚀 ELIMFILTERS Proxy API v4.1 corriendo en puerto ${PORT}`);
});
