// server.js v3.3.5 — Estable
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const detectionService = require('./detectionService');

// CORRECCIÓN CLAVE: Asegura que el nombre del archivo de servicio sea 'GoogleSheetsService.js'
// para evitar el error 'Cannot find module' debido a la sensibilidad a mayúsculas/minúsculas.
const GoogleSheetsService = require('./GoogleSheetsService'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Inicialización segura de Google Sheets
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

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ELIMFILTERS Proxy API',
    version: '3.3.5',
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter',
    },
  });
});

// Endpoint principal de detección
app.post('/api/detect-filter', async (req, res) => {
  const { query } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      status: 'ERROR',
      message: 'Falta parámetro "query" válido en el cuerpo de la solicitud',
    });
  }

  try {
    // Paso 1: buscar si ya existe en la hoja maestra
    const existingRow = sheetsInstance
      ? await sheetsInstance.findRowByQuery(query)
      : null;

    if (existingRow) {
      console.log('📗 Encontrado en Master Sheet:', query);
      return res.json({
        status: 'OK',
        source: 'Master',
        data: existingRow,
      });
    }

    // Paso 2: generar nuevo registro
    console.log('⚙️  Generando nuevo registro para:', query);
    const generatedData = await detectionService.detectFilter(query);

    // Paso 3: guardar en Google Sheets (Usando el método correcto 'replaceOrInsertRow')
    if (sheetsInstance && generatedData) {
      await sheetsInstance.replaceOrInsertRow(generatedData);
    }

    res.json({
      status: 'OK',
      source: 'Generated',
      data: generatedData,
    });
  } catch (error) {
    console.error('❌ Error en /api/detect-filter:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: 'Fallo interno en detect-filter',
      details: error.message,
    });
  }
});

// Fallback global
app.use((req, res) => {
  res.status(404).json({ status: 'ERROR', message: 'Ruta no encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
});
