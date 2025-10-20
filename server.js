require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');
const businessLogic = require('./businessLogic');

const app = express();
const PORT = process.env.PORT || 3000;

/* ===== CORS: limita a tu dominio ===== */
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://elimfilters.com,https://www.elimfilters.com')
  .split(',')
  .map(s => s.trim());
app.use(cors({ origin: (o, cb) => cb(null, !o || ORIGINS.includes(o)), methods: ['GET','POST'] }));
app.use(express.json({ limit: '1mb' }));

/* ===== n8n URLs: principal + fallback ===== */
const N8N_URL =
  process.env.N8N_WEBHOOK_URL ||   // debe ser la Production URL exacta del Webhook
  process.env.N8N_URL_PRIMARY ||
  process.env.N8N_URL_FALLBACK;

let sheetsInstance;

/* ---------- Init services ---------- */
async function initializeServices() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    detectionService.setSheetsInstance(sheetsInstance);
    console.log('Services initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing services:', error);
    throw error;
  }
}

/* ---------- Health ---------- */
app.get('/healthz', (_req, res) => res.send('ok'));
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    sheetsConnected: !!sheetsInstance,
    n8nUrlConfigured: !!N8N_URL
  });
});
app.get('/', (_req, res) => res.redirect('/health'));

/* ---------- Chat endpoint (WP widget) ---------- */
app.post('/chat', async (req, res) => {
  try {
    const message = req.body.message || req.body.text || req.body.content || '';
    const sessionId = req.body.sessionId || req.body.session_id || 'anon';

    if (!message.trim()) {
      return res.status(400).json({ reply: 'Por favor, ingrese un código válido.' });
    }
    if (!N8N_URL) {
      return res.status(503).json({ reply: 'Servicio técnico temporalmente no disponible. Intente nuevamente.' });
    }

    const r = await fetch(N8N_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId, source: 'wp-widget' })
    });

    if (!r.ok) {
      console.error('n8n error status:', r.status, await r.text().catch(()=> ''));
      return res.status(502).json({ reply: 'Error de conexión. Por favor intenta nuevamente.' });
    }

    const out = await r.json().catch(() => ({}));
    return res.json({ reply: out.reply ?? 'Error interno.' });
  } catch (e) {
    console.error('Proxy /chat error:', e);
    return res.status(502).json({ reply: 'Error de conexión. Por favor intenta nuevamente.' });
  }
});

/* ---------- API existentes (Sheets) ---------- */
app.get('/api/products', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({ success: false, error: 'Service unavailable', message: 'Google Sheets not initialized' });
    }
    const query = req.query.q || '';
    const products = await sheetsInstance.searchProducts(query);
    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: 'Error fetching products', message: error.message });
  }
});

app.get('/api/products/:sku', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({ success: false, error: 'Service unavailable', message: 'Google Sheets not initialized' });
    }
    const { sku } = req.params;
    const products = await sheetsInstance.searchProducts(sku);
    if (products.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: products[0] });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, error: 'Error fetching product', message: error.message });
  }
});

app.post('/api/detect-filter', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({ success: false, error: 'Service unavailable', message: 'Google Sheets not initialized' });
    }
    const { query } = req.body;
    if (!query || query.trim() === '') {
      return res.status(400).json({ success: false, error: 'Query required', message: 'Must provide a filter code to detect' });
    }
    console.log('Detecting filter for query:', query);
    const result = await detectionService.detectFilter(query);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error detecting filter:', error);
    res.status(500).json({ success: false, error: 'Error detecting filter', message: error.message });
  }
});

app.post('/api/generate-sku', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({ success: false, error: 'Service unavailable', message: 'Google Sheets not initialized' });
    }
    const { filterType, family, specs, oemCodes, crossReference, rawData } = req.body;
    if (!filterType || !family || !rawData) {
      return res.status(400).json({ success: false, error: 'Missing required fields', message: 'Required: filterType, family, rawData' });
    }
    console.log('Generating SKU for filter type:', filterType, 'family:', family);
    const sku = businessLogic.generateSKU(filterType, family, specs || {}, oemCodes || [], crossReference || [], rawData);
    res.json({ success: true, data: { sku, filterType, family, dutyLevel: rawData.duty_level, timestamp: new Date().toISOString() } });
  } catch (error) {
    console.error('Error generating SKU:', error);
    res.status(500).json({ success: false, error: 'Error generating SKU', message: error.message });
  }
});

app.post('/api/process-filter', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({ success: false, error: 'Service unavailable', message: 'Google Sheets not initialized' });
    }
    const { family, specs, oemCodes, crossReference, rawData } = req.body;
    if (!family || !rawData) {
      return res.status(400).json({ success: false, error: 'Missing required fields', message: 'Required: family, rawData' });
    }
    console.log('Processing filter data for family:', family);
    const processedData = businessLogic.processFilterData(family, specs || {}, oemCodes || [], crossReference || [], rawData);
    res.json({ success: true, data: processedData });
  } catch (error) {
    console.error('Error processing filter data:', error);
    res.status(500).json({ success: false, error: 'Error processing filter data', message: error.message });
  }
});

/* ---------- 404 y errores ---------- */
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', message: `The route ${req.method} ${req.path} does not exist` });
});
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
});

/* ---------- Start ---------- */
async function startServer() {
  try {
    await initializeServices();
    app.listen(PORT, '0.0.0.0', () => {
      console.log('Server running on port', PORT);
      console.log('Health: /health  /healthz');
      console.log('Chat:   POST /chat  →', N8N_URL ? 'OK' : 'MISSING N8N URL');
    });
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
}
startServer();

process.on('SIGTERM', () => { console.log('SIGTERM received, closing server...'); process.exit(0); });
process.on('SIGINT', () => { console.log('SIGINT received, closing server...'); process.exit(0); });
