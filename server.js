require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const GoogleSheetsService = require('./googleSheetsConnector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiter básico
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { status: 'ERROR', message: 'Too many requests' }
}));

let sheetsInstance;

// Inicializar Google Sheets
async function initializeSheets() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    console.log('✅ Sheets service ready');
  } catch (err) {
    console.error('❌ Could not initialize Sheets:', err.message);
  }
}
initializeSheets();

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '3.0.0',
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter'
    }
  });
});

// 🔍 Detect filter endpoint
app.post('/api/detect-filter', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || query.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Query required' });
    }

    if (!sheetsInstance) {
      return res.status(500).json({ status: 'ERROR', message: 'Sheets not initialized' });
    }

    const result = await sheetsInstance.findBySKUorOEM(query);
    if (!result) {
      return res.status(404).json({ status: 'NOT_FOUND', message: `No match for ${query}` });
    }

    // Formateo de respuesta limpio
    res.json({
      status: 'OK',
      sku: result.sku,
      family: result.family,
      duty: result.duty,
      filter_type: result.filter_type,
      media_type: result.media_type,
      description: result.description,
      oem_codes: result.oem_codes,
      cross_reference: result.cross_reference,
      engine_applications: result.engine_applications,
      equipment_applications: result.equipment_applications,
      height_mm: result.height_mm,
      outer_diameter_mm: result.outer_diameter_mm,
      thread_size: result.thread_size,
      micron_rating: result.micron_rating,
      bypass_valve_psi: result.bypass_valve_psi,
      hydrostatic_burst_psi: result.hydrostatic_burst_psi,
      rated_flow_gpm: result.rated_flow_gpm,
      weight_grams: result.weight_grams,
      manufacturing_standards: result.manufacturing_standards,
      certification_standards: result.certification_standards
    });

  } catch (error) {
    console.error('❌ Error in /api/detect-filter:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Fallo interno en detect-filter',
      details: error.message || null
    });
  }
});

// Servidor activo
app.listen(PORT, () => {
  console.log(`🚀 ELIMFILTERS Proxy API running on port ${PORT}`);
});
