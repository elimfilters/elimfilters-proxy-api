// server.js (ejemplo mínimo integrando GoogleSheetsService)
const express = require('express');
const bodyParser = require('body-parser');
const GoogleSheetsService = require('./googleSheetsConnector');

const app = express();
app.use(bodyParser.json());

// Parsear GOOGLE_CREDENTIALS robusto desde env
function loadGoogleCredentialsFromEnv() {
  const raw = process.env.GOOGLE_CREDENTIALS || process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!raw) return null;
  try {
    return GoogleSheetsService.parseCredentials(raw);
  } catch (err) {
    console.error('GOOGLE_CREDENTIALS parse error:', err.message);
    return null;
  }
}

const sheetId = process.env.SHEET_ID || process.env.GOOGLE_SHEET_ID;
const sheetRange = process.env.SHEET_RANGE || 'Master!A1:Z';

const credentials = loadGoogleCredentialsFromEnv();

let gsService = null;
if (credentials && sheetId) {
  try {
    gsService = new GoogleSheetsService({ credentials, sheetId, range: sheetRange });
    console.log('GoogleSheetsService preparado (no se inicializó auth aún).');
  } catch (err) {
    console.error('Error instanciando GoogleSheetsService:', err.message);
  }
} else {
  console.warn('No hay GOOGLE_CREDENTIALS o SHEET_ID configurados. GoogleSheetsService NO estará disponible.');
}

// Health
app.get('/health', async (req, res) => {
  const out = { status: 'ok', google_sheets: 'not_ready', info: null };
  if (!gsService) {
    out.google_sheets = 'not_ready';
    out.info = 'gsService_not_instantiated';
    return res.json(out);
  }
  try {
    const headers = await gsService.getDetectedHeaders();
    out.google_sheets = 'ready';
    out.info = { headers_count: headers.length, sample_headers: headers.slice(0, 10) };
    return res.json(out);
  } catch (err) {
    out.google_sheets = 'not_ready';
    out.info = err.message;
    return res.json(out);
  }
});

// Endpoint diagnostico: headers detectados y mapeo básico
app.get('/products/columns', async (req, res) => {
  if (!gsService) return res.status(500).json({ ok: false, error: 'gsService_not_configured' });
  try {
    const headers = await gsService.getDetectedHeaders();
    const expected = GoogleSheetsService.EXPECTED_HEADERS();
    // mapeo: expected -> present (true/false) y index si existe
    const lower = headers.map(h => (h||'').toLowerCase());
    const mapping = expected.map(e => {
      const idx = lower.indexOf(e.toLowerCase());
      return { field: e, present: idx !== -1, index: idx };
    });
    return res.json({ ok: true, detected_headers: headers, mapping });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Schemas por categoria
app.get('/schemas', (req, res) => {
  if (!gsService) return res.status(500).json({ ok: false, error: 'gsService_not_configured' });
  try {
    const schemas = gsService.getSchemas();
    return res.json({ ok: true, schemas });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Listar productos (con category y limit)
app.get('/products', async (req, res) => {
  if (!gsService) return res.status(500).json({ ok: false, error: 'gsService_not_configured' });
  const category = req.query.category || null;
  const limit = Number(req.query.limit) || 1000;
  try {
    const data = await gsService.getProducts({ category, limit });
    return res.json({ ok: true, count: data.length, data });
  } catch (err) {
    console.error('/products error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Obtener por SKU
app.get('/product/:id', async (req, res) => {
  if (!gsService) return res.status(500).json({ ok: false, error: 'gsService_not_configured' });
  try {
    const item = await gsService.getProductById(req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, data: item });
  } catch (err) {
    console.error('/product/:id error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Search
app.get('/search', async (req, res) => {
  if (!gsService) return res.status(500).json({ ok: false, error: 'gsService_not_configured' });
  const q = req.query.q;
  if (!q) return res.status(400).json({ ok: false, error: 'missing_q' });
  const category = req.query.category || null;
  const limit = Number(req.query.limit) || 50;
  try {
    const results = await gsService.search(q, { category, limit });
    return res.json({ ok: true, count: results.length, data: results });
  } catch (err) {
    console.error('/search error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
