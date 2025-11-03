// =========================================
// ELIMFILTERS Proxy API v4.0.0
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

// Seguridad y control
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { status: 'ERROR', message: 'Too many requests' }
}));

let sheetsInstance = null;

// === Inicialización del Google Sheets ===
async function initializeSheets() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    console.log('✅ Google Sheets conectado correctamente');
  } catch (err) {
    console.error('❌ Error inicializando Google Sheets:', err.message);
  }
}
initializeSheets();

// === Health Check ===
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '4.0.0',
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter'
    }
  });
});

// === Endpoint principal ===
app.post('/api/detect-filter', async (req, res) => {
  const { query } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ status: 'ERROR', message: 'Query required' });
  }

  const code = query.trim().toUpperCase();
  console.log(`🔍 Solicitud recibida: ${code}`);

  try {
    if (!sheetsInstance) {
      return res.status(500).json({ status: 'ERROR', message: 'Sheets not initialized' });
    }

    // === 1️⃣ Buscar en hoja Master ===
    const found = await sheetsInstance.findProduct(code);
    if (found) {
      console.log(`✅ Encontrado en hoja: ${found.sku}`);
      return res.json({ status: 'OK', source: 'database', data: found });
    }

    // === 2️⃣ No encontrado → ejecutar lógica ===
    console.log('⚙️ No existe en hoja, ejecutando detección lógica...');
    const result = await detectionService.detectFilter(code);

    // === 3️⃣ Insertar nuevo registro ===
    console.log(`📝 Insertando nuevo SKU en hoja: ${result.final_sku}`);
    await sheetsInstance.addProduct(result);

    // === 4️⃣ Devolver respuesta ===
    res.json({
      status: 'OK',
      source: 'new_generated',
      data: result
    });

  } catch (error) {
    console.error('❌ Error general detect-filter:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Fallo interno en detect-filter',
      details: error.message || null
    });
  }
});

// === Servidor activo ===
app.listen(PORT, () => {
  console.log(`🚀 ELIMFILTERS Proxy API v4.0.0 corriendo en puerto ${PORT}`);
});
