require('dotenv').config();
const express = require('express');
const cors = require('cors');

const GoogleSheetsService = require('./googleSheetsConnector');
const { processFilterCode } = require('./filterProcessor');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Init Google Sheets
let sheetsInstance;
async function init() {
  sheetsInstance = new GoogleSheetsService();
  await sheetsInstance.initialize();
  console.log('✅ Google Sheets Service inicializado correctamente');
}
init().catch(err => {
  console.error('❌ Error inicializando Google Sheets:', err);
  process.exit(1);
});

// Health
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'elimfilters-proxy-api',
    version: '3.0.0',
    rules_version: '2.2.3',
    timestamp: new Date().toISOString()
  });
});

// Util: valida API Key si está definida
function apiKeyOk(req) {
  const provided = req.header('x-api-key') || '';
  const expected = process.env.API_KEY || 'Elimperca';
  return provided === expected;
}

// Endpoint principal
app.post('/api/detect-filter', async (req, res) => {
  try {
    if (!apiKeyOk(req)) return res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });

    const { query } = req.body || {};
    if (!query) return res.status(400).json({ ok: false, code: 'MISSING_QUERY' });

    // PASO CLAVE: pasar el body completo para family/duty
    const result = await processFilterCode(query, { sheetsInstance, reqBody: req.body });
    res.status(200).json(result);
  } catch (err) {
    console.error('❌ Error en /api/detect-filter:', err);
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

// 404
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.listen(PORT, () => {
  console.log(`🚀 ELIMFILTERS Proxy API v3.0.0 ejecutándose en puerto ${PORT}`);
});

module.exports = app;
