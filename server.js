require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const detectionService = require('./detectionService');
const GoogleSheetsService = require('./googleSheetsConnector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(helmet());

// === Rate limiter ===
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
}));

// === Inicialización de Google Sheets ===
let sheetsInstance;

(async () => {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    console.log('✅ Google Sheets conectado correctamente.');
  } catch (err) {
    console.error('❌ Error al inicializar Google Sheets:', err.message);
  }
})();

// === Endpoint de salud ===
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '3.3.2',
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter',
    },
  });
});

// === Endpoint principal ===
app.post('/api/detect-filter', async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Parámetro "query" es requerido.',
      });
    }

    const normalized = query.trim().toUpperCase();
    console.log(`🔍 Consulta recibida: ${normalized}`);

    // === 1️⃣ Buscar en Google Sheets Master ===
    let rowData = null;
    try {
      rowData = await sheetsInstance.findRowByQuery(normalized);
    } catch (err) {
      console.error('⚠️ Error al buscar en Sheets:', err.message);
    }

    // === 2️⃣ Si existe en hoja, devolver ===
    if (rowData) {
      console.log(`📗 Resultado encontrado en hoja: ${normalized}`);
      return res.json({
        status: 'OK',
        source: 'Master',
        data: rowData,
      });
    }

    // === 3️⃣ Si no existe, generar con lógica interna ===
    console.log(`⚙️ Generando nuevo registro para: ${normalized}`);
    const result = detectionService.detectFilter(normalized);

    // === 4️⃣ Insertar en la hoja ===
    try {
      await sheetsInstance.appendRow([
        result.query_norm,
        result.final_sku,
        result.family,
        result.duty,
        '', '', result.filter_type,
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '',
        result.description
      ]);
      console.log(`✅ Nuevo registro añadido a Google Sheets: ${result.final_sku}`);
    } catch (err) {
      console.error('⚠️ Error al agregar a Sheets:', err.message);
    }

    // === 5️⃣ Retornar resultado ===
    return res.json({
      status: 'OK',
      source: 'Generated',
      data: result,
    });

  } catch (error) {
    console.error('❌ Error en detect-filter:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Fallo interno en detect-filter',
      details: error.message,
    });
  }
});

// === Server Start ===
app.listen(PORT, () => {
  console.log(`🚀 ELIMFILTERS Proxy API ejecutándose en puerto ${PORT}`);
});
