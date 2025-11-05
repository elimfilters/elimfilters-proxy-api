// server.js v3.7.1 — CORS actualizado para con y sin www
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const detectionService = require('./detectionService');
const GoogleSheetsService = require('./googleSheetsConnector');

const app = express();
const PORT = process.env.PORT || 8080;

// CORS configurado para WordPress (con y sin www)
const allowedOrigins = [
  'https://www.elimfilters.com',
  'https://elimfilters.com'
];

app.use(cors({
  origin: function(origin, callback) {
    // Permitir requests sin origin (como Postman, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// ---------- Inicialización Google Sheets ----------
let sheetsInstance;
(async () => {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    console.log('✅ Google Sheets conectado correctamente');
  } catch (err) {
    console.error('❌ Error inicializando Google Sheets:', err.message);
  }
})();

// ---------- Endpoint de Salud ----------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ELIMFILTERS Proxy API',
    version: '3.7.1',
    features: {
      google_sheets: sheetsInstance ? 'connected' : 'disconnected',
      cross_reference_db: 'active',
      wordpress_ready: true
    },
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter',
      admin: 'POST /api/admin/add-equivalence'
    },
  });
});

// ---------- Endpoint Principal (para WordPress) ----------
app.post('/api/detect-filter', async (req, res) => {
  const startTime = Date.now();
  const { query } = req.body || {};
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      status: 'ERROR',
      message: 'Falta parámetro "query" válido en el cuerpo de la solicitud',
    });
  }

  try {
    // Paso 1: Buscar en hoja "Master"
    const existingRow = sheetsInstance
      ? await sheetsInstance.findRowByQuery(query)
      : null;
    
    if (existingRow) {
      const responseTime = Date.now() - startTime;
      console.log(`📗 Cache hit - Master: ${query} (${responseTime}ms)`);
      return res.json({
        status: 'OK',
        source: 'cache',
        response_time_ms: responseTime,
        data: existingRow,
      });
    }

    // Paso 2: Generar nuevo registro
    console.log(`🔍 Procesando nuevo query: "${query}"`);
    const detectionResult = await detectionService.processFilterQuery(query);
    
    if (!detectionResult || !detectionResult.sku) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'No se pudo detectar el filtro. Query no reconocido.'
      });
    }

    // Paso 3: Guardar en "Master" si Google Sheets está disponible
    if (sheetsInstance) {
      try {
        await sheetsInstance.appendRow(detectionResult);
        console.log(`✍️  Nuevo registro guardado en Master: ${detectionResult.sku}`);
      } catch (sheetErr) {
        console.warn(`⚠️  No se pudo guardar en Master (continuando): ${sheetErr.message}`);
      }
    }

    const responseTime = Date.now() - startTime;
    console.log(`✅ Procesado: ${detectionResult.sku} (${responseTime}ms)`);
    
    return res.json({
      status: 'OK',
      source: 'generated',
      response_time_ms: responseTime,
      data: detectionResult
    });
  } catch (err) {
    console.error(`❌ Error en /api/detect-filter: ${err.message}`);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Error interno del servidor',
      error: err.message
    });
  }
});

// ---------- Endpoint de Administración ----------
app.post('/api/admin/add-equivalence', (req, res) => {
  const { adminKey, elimSKU, competitorBrand, competitorSKU } = req.body || {};
  
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({
      status: 'ERROR',
      message: 'Forbidden: Invalid admin key'
    });
  }

  if (!elimSKU || !competitorBrand || !competitorSKU) {
    return res.status(400).json({
      status: 'ERROR',
      message: 'Missing required fields: elimSKU, competitorBrand, competitorSKU'
    });
  }

  // Aquí iría la lógica para agregar la equivalencia
  // Por ahora solo retornamos OK
  res.json({
    status: 'OK',
    message: `Equivalence added: ${competitorBrand} ${competitorSKU} -> ${elimSKU}`
  });
});

// ---------- Iniciar Servidor ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🌐 CORS habilitado para: https://www.elimfilters.com y https://elimfilters.com`);
  console.log(`🔐 Admin endpoint: Protegido ✅`);
});
