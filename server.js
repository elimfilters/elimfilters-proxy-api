require('dotenv').config();
const express = require('express');
const cors = require('cors');
const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let sheetsInstance;

async function initializeServices() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    detectionService.setSheetsInstance(sheetsInstance);
    console.log('✅ Google Sheets conectado');
  } catch (err) {
    console.error('❌ Error iniciando servicios:', err);
  }
}

initializeServices();

// --- ENDPOINTS ---
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '3.3.5',
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter',
    },
  });
});

app.post('/api/detect-filter', async (req, res) => {
  try {
    const { query } = req.body;
    const result = await detectionService.detectFilter(query);
    res.status(200).json(result);
  } catch (err) {
    console.error('❌ Error detect-filter:', err);
    res.status(500).json({ status: 'error', message: 'Detection failed' });
  }
});

app.listen(PORT, () => console.log(`🚀 API activa en puerto ${PORT}`));
