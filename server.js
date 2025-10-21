require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // v2 (CommonJS)

const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');
const businessLogic = require('./businessLogic');

const app = express();
const PORT = process.env.PORT || 3000;

/* ===== CORS ===== */
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://elimfilters.com,https://www.elimfilters.com')
  .split(',').map(s => s.trim());
app.use((req,res,next)=>{
  // CORS manual para asegurar preflight correcto
  const origin = req.headers.origin;
  if (!origin || ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(express.json({ limit: '1mb' }));

/* ===== n8n URL ===== */
const N8N_URL =
  process.env.N8N_WEBHOOK_URL ||
  process.env.N8N_URL_PRIMARY ||
  process.env.N8N_URL_FALLBACK; // ej: https://...n8n.cloud/webhook/api/v1/filters/search

/* ===== Google Sheets (opcional) ===== */
let sheetsInstance;
async function initializeServices() {
  sheetsInstance = new GoogleSheetsService();
  await sheetsInstance.initialize();
  detectionService.setSheetsInstance(sheetsInstance);
  console.log('Services initialized');
}

/* ===== Health ===== */
app.get('/healthz', (_req, res) => res.send('ok'));
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    sheetsConnected: !!sheetsInstance,
    n8nUrlConfigured: !!N8N_URL
  });
});
app.get('/', (_req, res) => res.redirect('/health'));

/* ===== Helper: forward to n8n con payload esperado por tu flujo ===== */
async function forwardToN8N(query, extra = {}) {
  if (!N8N_URL) return { ok:false, status:503, body:{ reply:'Service unavailable' } };
  const payload = {
    body: { source: 'web', query },
    headers: extra.headers || {},
    meta: { sessionId: extra.sessionId || 'anon', origin: extra.origin || '' }
  };
  const r = await fetch(N8N_URL, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload),
    timeout: 15000
  });
  const text = await r.text().catch(()=> '');
  let json;
  try { json = JSON.parse(text); } catch { json = { raw:text }; }
  return { ok:r.ok, status:r.status, body:json };
}

/* ===== Chat endpoint simple (compatibilidad con tu widget actual) ===== */
app.post('/chat', async (req, res) => {
  try {
    const message = req.body?.message || req.body?.text || req.body?.content || '';
    const sessionId = req.body?.sessionId || req.body?.session_id || 'anon';
    if (!message.trim()) return res.status(400).json({ reply: 'Ingrese un código válido.' });

    const fx = await forwardToN8N(message, { sessionId, origin: req.headers.origin });
    if (!fx.ok) return res.status(502).json({ reply:'Error de conexión. Intente nuevamente.' });

    // Adapta respuesta: prioriza message o filter.sku
    const b = fx.body || {};
    const reply = b.message || (b.filter ? `${b.filter.filter_type||'FILTER'} (${b.filter.sku||'N/A'})` : 'Sin datos');
    return res.json({ reply, raw: b });
  } catch (e) {
    console.error('Proxy /chat error:', e);
    return res.status(502).json({ reply: 'Error de conexión. Intente nuevamente.' });
  }
});

/* ===== Endpoint REST usado por el chatbot nuevo ===== */
app.post('/api/v1/filters/search', async (req, res) => {
  try {
    const q =
      req.body?.body?.query ||
      req.body?.query ||
      req.body?.q ||
      req.body?.message ||
      '';
    const sessionId = req.body?.sessionId || 'anon';
    if (!q.trim()) return res.status(400).json({ success:false, error:'Query required' });

    const fx = await forwardToN8N(q, { sessionId, origin: req.headers.origin });
    return res.status(fx.status).json(fx.body);
  } catch (e) {
    console.error('Proxy /api/v1/filters/search error:', e);
    return res.status(502).json({ success:false, error:'proxy_failed' });
  }
});

/* ===== APIs existentes (Sheets opcional) ===== */
app.get('/api/products', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success:false, error:'Service unavailable', message:'Google Sheets not initialized' });
    const query = req.query.q || '';
    const products = await sheetsInstance.searchProducts(query);
    res.json({ success:true, count: products.length, data: products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success:false, error:'Error fetching products', message:error.message });
  }
});

app.get('/api/products/:sku', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success:false, error:'Service unavailable', message:'Google Sheets not initialized' });
    const { sku } = req.params;
    const products = await sheetsInstance.searchProducts(sku);
    if (products.length === 0) return res.status(404).json({ success:false, error:'Product not found' });
    res.json({ success:true, data: products[0] });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success:false, error:'Error fetching product', message:error.message });
  }
});

app.post('/api/detect-filter', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success:false, error:'Service unavailable', message:'Google Sheets not initialized' });
    const { query } = req.body;
    if (!query || query.trim() === '') return res.status(400).json({ success:false, error:'Query required' });
    const result = await detectionService.detectFilter(query);
    res.json({ success:true, data: result });
  } catch (error) {
    console.error('Error detecting filter:', error);
    res.status(500).json({ success:false, error:'Error detecting filter', message:error.message });
  }
});

app.post('/api/generate-sku', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success:false, error:'Service unavailable', message:'Google Sheets not initialized' });
    const { filterType, family, specs, oemCodes, crossReference, rawData } = req.body;
    if (!filterType || !family || !rawData) return res.status(400).json({ success:false, error:'Missing fields', message:'Required: filterType, family, rawData' });
    const sku = businessLogic.generateSKU(filterType, family, specs||{}, oemCodes||[], crossReference||[], rawData);
    res.json({ success:true, data:{ sku, filterType, family, dutyLevel: rawData.duty_level, timestamp:new Date().toISOString() } });
  } catch (error) {
    console.error('Error generating SKU:', error);
    res.status(500).json({ success:false, error:'Error generating SKU', message:error.message });
  }
});

app.post('/api/process-filter', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success:false, error:'Service unavailable', message:'Google Sheets not initialized' });
    const { family, specs, oemCodes, crossReference, rawData } = req.body;
    if (!family || !rawData) return res.status(400).json({ success:false, error:'Missing fields', message:'Required: family, rawData' });
    const processedData = businessLogic.processFilterData(family, specs||{}, oemCodes||[], crossReference||[], rawData);
    res.json({ success:true, data: processedData });
  } catch (error) {
    console.error('Error processing filter data:', error);
    res.status(500).json({ success:false, error:'Error processing filter data', message:error.message });
  }
});

/* ===== 404 + errores ===== */
app.use((req, res) => res.status(404).json({ success:false, error:'Route not found', message:`${req.method} ${req.path} does not exist` }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success:false, error:'Internal server error', message: err.message });
});

/* ===== Start ===== */
async function safeInit() {
  if (process.env.SKIP_SHEETS_INIT === 'true') { console.warn('SKIP_SHEETS_INIT=true → no Google Sheets'); return; }
  try { await initializeServices(); } catch (e) { console.error('Sheets init FAILED. Server up. Reason:', e?.message); }
}
app.listen(PORT, '0.0.0.0', () => {
  console.log('Port', PORT);
  console.log('Health: GET /health  /healthz');
  console.log('Proxy:  POST /api/v1/filters/search  POST /chat  →', N8N_URL || 'MISSING N8N URL');
  safeInit();
});
process.on('SIGTERM', () => { console.log('SIGTERM'); process.exit(0); });
process.on('SIGINT',  () => { console.log('SIGINT');  process.exit(0); });
