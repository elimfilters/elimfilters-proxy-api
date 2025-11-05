// server.js v3.8.1 — Estable y compatible con GoDaddy HTTPS
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const detectionService = require('./detectionService');
const GoogleSheetsService = require('./googleSheetsConnector');

const app = express();
const PORT = process.env.PORT || 8080;

// ---------- CORS CONFIG (GoDaddy y n8n) ----------
app.use((req, res, next) => {
  const allowedOrigins = [
    "https://elimfilters.com",
    "https://elimfilterscross.app.n8n.cloud"
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

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

// ---------- Endpoint de salud ----------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ELIMFILTERS Proxy API',
    version: '3.8.1',
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

// ---------- Endpoint principal ----------
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

    console.log(`⚙️ Generando SKU para: ${query}`);
    const generatedData = await detectionService.detectFilter(query, sheetsInstance);

    if (sheetsInstance && generatedData) {
      await sheetsInstance.replaceOrInsertRow(generatedData);
    }

    const responseTime = Date.now() - startTime;
    console.log(`✅ SKU generado: ${generatedData.sku} (${responseTime}ms)`);

    res.json({
      status: 'OK',
      source: 'generated',
      response_time_ms: responseTime,
      data: generatedData,
    });
  } catch (error) {
    console.error('❌ Error en /api/detect-filter:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: 'Error interno del servidor',
      details: error.message,
    });
  }
});

// ---------- Endpoint admin (gestión manual) ----------
app.post('/api/admin/add-equivalence', async (req, res) => {
  const { oem_number, donaldson, fram, family, admin_key } = req.body || {};

  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({
      status: 'ERROR',
      message: 'Clave de administrador inválida',
    });
  }

  if (!oem_number || !family) {
    return res.status(400).json({
      status: 'ERROR',
      message: 'Faltan parámetros: oem_number y family son requeridos',
    });
  }

  try {
    if (sheetsInstance) {
      await sheetsInstance.saveCrossReference(oem_number, donaldson, fram, family);
      res.json({
        status: 'OK',
        message: 'Equivalencia agregada exitosamente',
        data: { oem_number, donaldson, fram, family }
      });
    } else {
      res.status(503).json({
        status: 'ERROR',
        message: 'Google Sheets no disponible',
      });
    }
  } catch (error) {
    console.error('❌ Error agregando equivalencia:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: 'Error al agregar equivalencia',
      details: error.message,
    });
  }
});

// ---------- Fallback ----------
app.use((req, res) => {
  res.status(404).json({ status: 'ERROR', message: 'Ruta no encontrada' });
});

// ---------- Iniciar servidor ----------
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🌐 CORS habilitado para elimfilters.com y n8n`);
  console.log(`🔐 Admin endpoint: ${process.env.ADMIN_KEY ? 'Protegido ✅' : '⚠️ SIN PROTECCIÓN'}`);
});
