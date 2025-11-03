require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(helmet());

// limiter para evitar abusos
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// instancia global del servicio de Google Sheets
let sheetsInstance;

async function initializeServices() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    detectionService.setSheetsInstance(sheetsInstance);
    console.log('✅ GoogleSheetsService inicializado correctamente');
  } catch (err) {
    console.error('❌ Error inicializando GoogleSheetsService:', err);
  }
}
initializeServices();

// --- ENDPOINTS ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '3.3.4',
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter'
    }
  });
});

app.post('/api/detect-filter', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Missing required field: query'
      });
    }

    // si no está inicializado sheetsInstance, lo crea de nuevo
    if (!sheetsInstance) {
      sheetsInstance = new GoogleSheetsService();
      await sheetsInstance.initialize();
      detectionService.setSheetsInstance(sheetsInstance);
    }

    const result = await detectionService.detectFilter(query);
    res.json(result);

  } catch (err) {
    console.error('❌ Error en detect-filter:', err);
    res.status(500).json({
      status: 'ERROR',
      message: 'Fallo interno en detect-filter',
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 ELIMFILTERS Proxy API ejecutándose en puerto ${PORT}`);
});
