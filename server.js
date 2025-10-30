// server.js — ELIMFILTERS Proxy API v3.0.0 (sin IA ni n8n)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');
const { processFilterCode } = require('./filterProcessor');
const rulesProtection = require('./rulesProtection');
const security = require('./security');

const app = express();
app.set('trust proxy', 1);

// Seguridad headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS desde env (coma-separados)
const allowed = (process.env.ALLOWED_ORIGINS || 'https://elimfilters.com,https://www.elimfilters.com')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowed, methods: ['GET','POST'] }));

app.use(express.json());

// Rate limit
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

// Inicialización de servicios
let sheetsInstance;
async function initializeServices() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    detectionService.setSheetsInstance(sheetsInstance);
    console.log('✅ Google Sheets Service inicializado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando Google Sheets:', error.message);
  }
}
initializeServices();

// Health
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'elimfilters-proxy-api',
    version: '3.0.0',
    rules_version: '2.2.3',
    timestamp: new Date().toISOString(),
  });
});

// Detect filter (OEM/XREF crean; SKU solo si existe)
app.post('/api/detect-filter', security.verifyKey, async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query vacía o inválida' });
    }
    const result = await processFilterCode(query, { sheetsInstance });
    res.json(result);
  } catch (err) {
    console.error('❌ Error procesando /api/detect-filter:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Reglas: solo metadatos
app.get('/api/rules', security.verifyKey, (req, res) => {
  const meta = rulesProtection.getRulesMetadata();
  res.status(200).json(meta);
});

// 404 y errores
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 ELIMFILTERS Proxy API v3.0.0 ejecutándose en puerto ${PORT}`);
});
