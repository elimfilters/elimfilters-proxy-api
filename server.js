// server.js
// Minimal, robust server for reading a Google Sheet and exposing endpoints.
// Dependencies: express, googleapis, dotenv, cors, helmet

// Load env from .env when running locally
require('dotenv').config();

// ---------------- decode GOOGLE_CREDENTIALS_BASE64 into GOOGLE_CREDENTIALS if present --------
if (!process.env.GOOGLE_CREDENTIALS && process.env.GOOGLE_CREDENTIALS_BASE64) {
  try {
    process.env.GOOGLE_CREDENTIALS = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
    console.log('Decoded GOOGLE_CREDENTIALS from GOOGLE_CREDENTIALS_BASE64');
  } catch (e) {
    console.error('Failed to decode GOOGLE_CREDENTIALS_BASE64:', e.message);
  }
}
// -----------------------------------------------------------------------------------------

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Config
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const SHEET_ID = process.env.SHEET_ID || '';
const SHEET_RANGE = process.env.SHEET_RANGE || 'Master!A:O'; // default to Master sheet A:O
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || null; // optional basic protection for admin endpoints

// Helper: parse credentials JSON (string or object)
function parseCredentials(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    // raw may contain literal "\n" sequences (escaped), try JSON.parse directly
    return JSON.parse(raw);
  } catch (e) {
    // If it's double-escaped (has \\n), try replace
    try {
      const replaced = raw.replace(/\\n/g, '\n');
      return JSON.parse(replaced);
    } catch (e2) {
      throw new Error('Failed to parse GOOGLE_CREDENTIALS JSON: ' + e2.message);
    }
  }
}

// Create a Google Sheets client (returns an object with method getValues)
async function createSheetsClient() {
  const rawCred = process.env.GOOGLE_CREDENTIALS;
  if (!rawCred) {
    throw new Error('Missing GOOGLE_CREDENTIALS environment variable');
  }
  const creds = parseCredentials(rawCred);

  // Service account uses client_email and private_key
  if (!creds.client_email || !creds.private_key) {
    throw new Error('GOOGLE_CREDENTIALS missing client_email or private_key');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  return {
    // returns rows as array of arrays or throws
    async getValues(range = SHEET_RANGE) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range,
        majorDimension: 'ROWS',
      });
      return res.data.values || [];
    }
  };
}

// Cache sheets client instance so we don't recreate each request
let sheetsClientPromise = null;
function getSheetsClientPromise() {
  if (!sheetsClientPromise) {
    sheetsClientPromise = createSheetsClient().catch(err => {
      // keep the rejected promise so subsequent calls don't try infinite times
      console.error('Failed to initialize Google Sheets client:', err.message || err);
      throw err;
    });
  }
  return sheetsClientPromise;
}

// Map rows (array of arrays) into array of objects using first row as header
function rowsToObjects(rows = []) {
  if (!rows || rows.length === 0) return [];
  const header = rows[0].map(h => (h || '').toString().trim());
  const dataRows = rows.slice(1);
  return dataRows.map(row => {
    const item = {};
    for (let i = 0; i < header.length; i++) {
      const key = header[i] || `col_${i}`;
      item[key] = row[i] !== undefined ? row[i] : '';
    }
    return item;
  });
}

// Basic middleware to require INTERNAL_API_KEY for private endpoints (optional)
function requireInternalKey(req, res, next) {
  if (!INTERNAL_API_KEY) return next();
  const key = req.header('x-internal-api-key') || req.query.internal_api_key;
  if (!key || key !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Simple root
app.get('/', (req, res) => {
  res.json({ service: 'elimfilters-proxy-api', sheetId: SHEET_ID || null });
});

// GET /products - returns all rows mapped as objects
app.get('/products', async (req, res) => {
  if (!SHEET_ID) return res.status(400).json({ error: 'SHEET_ID env var not configured' });

  try {
    const client = await getSheetsClientPromise();
    const rows = await client.getValues(SHEET_RANGE);
    const items = rowsToObjects(rows);
    res.json({ count: items.length, items });
  } catch (err) {
    console.error('Error fetching products:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch products', details: err.message || String(err) });
  }
});

// GET /search?q=... - simple search on all fields (case-insensitive substring)
app.get('/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'Missing q query parameter' });
  if (!SHEET_ID) return res.status(400).json({ error: 'SHEET_ID env var not configured' });

  try {
    const client = await getSheetsClientPromise();
    const rows = await client.getValues(SHEET_RANGE);
    const items = rowsToObjects(rows);

    const qlc = q.toLowerCase();
    const filtered = items.filter(item => {
      for (const k of Object.keys(item)) {
        if ((item[k] || '').toString().toLowerCase().includes(qlc)) return true;
      }
      return false;
    });

    res.json({ query: q, count: filtered.length, items: filtered });
  } catch (err) {
    console.error('Error searching products:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to search products', details: err.message || String(err) });
  }
});

// GET /product/:id - find product by a column named 'id' or 'ID' or 'Id' (first match)
app.get('/product/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'Missing id param' });
  if (!SHEET_ID) return res.status(400).json({ error: 'SHEET_ID env var not configured' });

  try {
    const client = await getSheetsClientPromise();
    const rows = await client.getValues(SHEET_RANGE);
    const items = rowsToObjects(rows);

    const keyCandidates = ['id', 'ID', 'Id', 'code', 'Code', 'SKU', 'sku'];
    let found = null;
    for (const item of items) {
      for (const k of Object.keys(item)) {
        if (keyCandidates.includes(k) && item[k].toString() === id) {
          found = item;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      // fallback: search any field exact match
      found = items.find(it => Object.values(it).some(v => v.toString() === id));
    }

    if (!found) return res.status(404).json({ error: 'Not found' });
    res.json(found);
  } catch (err) {
    console.error('Error fetching product by id:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch product', details: err.message || String(err) });
  }
});

// Example protected endpoint using INTERNAL_API_KEY
app.post('/admin/refresh-cache', requireInternalKey, async (req, res) => {
  // If you implement caching, refresh the cache here. For now just test auth.
  res.json({ ok: true, message: 'auth ok' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.warn('Warning: GOOGLE_CREDENTIALS environment variable is not set. Google Sheets calls will fail until configured.');
  }
  if (!SHEET_ID) {
    console.warn('Warning: SHEET_ID environment variable is not set. /products and /search will return errors until configured.');
  }
});
