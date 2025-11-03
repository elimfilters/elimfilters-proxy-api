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

// Inicializar Google Sheets
async function initializeSheets() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    console.log('✅ Google Sheets conectado');
  } catch (err) {
    console.error('❌ Error al inicializar Google Sheets:', err);
  }
}
initializeSheets();

// ---------- ENDPOINTS ----------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '4.1',
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter',
    },
  });
});

// Detecta filtro y genera respuesta completa
app.post('/api/detect-filter', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ status: 'ERROR', message: 'Falta el parámetro query' });

  try {
    const normalizedQuery = query.trim().toUpperCase();

    // Buscar en hoja Master primero
    const existing = await sheetsInstance.findRowBySKU(normalizedQuery);
    if (existing) {
      return res.json({
        status: 'OK',
        source: 'Master',
        data: existing,
      });
    }

    // Si no existe, generar datos nuevos
    const detected = await detectionService.detectFilter(normalizedQuery);
    if (!detected) {
      return res.json({ status: 'ERROR', message: 'No se pudo generar información para el filtro' });
    }

    // Insertar fila nueva en hoja
    await sheetsInstance.appendRow(detected);

    return res.json({
      status: 'OK',
      source: 'Generated',
      data: detected,
    });
  } catch (err) {
    console.error('❌ Error en detect-filter:', err);
    res.status(500).json({
      status: 'ERROR',
      message: 'Fallo interno en detect-filter',
      details: err.message,
    });
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor activo en puerto ${PORT}`));
