// server.js (versión tolerante y compatible con los nombres de variables en Railway)
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const GoogleSheetsService = require('./googleSheetsConnector');

const PORT = process.env.PORT || 3000;

function tryParseJSON(input) {
  if (!input) return null;
  if (typeof input === 'object') return input;
  // Trim
  const s = String(input).trim();

  // 1) If looks like base64 (simple heuristic) try decode
  try {
    // only attempt base64 decode if it seems to be base64 (no spaces and = at end or high length)
    if (!s.includes('{') && !s.includes('}') && /^[A-Za-z0-9+/=]+$/.test(s) && s.length > 200) {
      const decoded = Buffer.from(s, 'base64').toString('utf8');
      return JSON.parse(decoded);
    }
  } catch (e) {
    // ignore and continue
  }

  // 2) Try normal JSON parse
  try {
    return JSON.parse(s);
  } catch (err) {
    // 3) Try replace escaped newlines and parse
    try {
      const repaired = s.replace(/\\n/g, '\n');
      return JSON.parse(repaired);
    } catch (err2) {
      // 4) If wrapped in quotes (e.g. '"{...}"'), try unwrapping
      try {
        const unwrapped = s.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
        return JSON.parse(unwrapped);
      } catch (err3) {
        throw new Error('No se pudo parsear JSON de credenciales: ' + err3.message);
      }
    }
  }
}

async function createGoogleServiceIfPossible() {
  const credEnv = process.env.GOOGLE_CREDENTIALS || process.env.GOOGLE_CRED || process.env.GOOGLE_CREDENTIAL;
  const sheetEnv = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID || process.env.SHEETID || process.env.GOOGLE_SHEETID;
  if (!credEnv) {
    console.warn('GOOGLE_CREDENTIALS no encontrada en variables de entorno.');
    return { ok: false, reason: 'missing_credentials' };
  }
  if (!sheetEnv) {
    console.warn('SHEET ID no encontrada en variables de entorno (buscado GOOGLE_SHEET_ID / SHEET_ID).');
    return { ok: false, reason: 'missing_sheet_id' };
  }

  let credentials;
  try {
    credentials = tryParseJSON(credEnv);
  } catch (err) {
    console.error('Error parseando GOOGLE_CREDENTIALS:', err.message);
    return { ok: false, reason: 'bad_credentials', error: err.message };
  }

  try {
    const gs = new GoogleSheetsService({ credentials, sheetId: sheetEnv });
    // Not initializing auth here to avoid blocking startup; methods will initialize on demand.
    return { ok: true, service: gs };
  } catch (err) {
    console.error('Error creando GoogleSheetsService:', err);
    return { ok: false, reason: 'service_init_failed', error: err.message || String(err) };
  }
}

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  let gsWrapper = { ready: false, service: null, info: null };

  // Intentar crear el servicio ahora (no salimos si falla)
  const created = await createGoogleServiceIfPossible();
  if (created.ok) {
    gsWrapper = { ready: true, service: created.service, info: null };
    console.log('GoogleSheetsService preparado (no se inicializó auth aún).');
  } else {
    gsWrapper = { ready: false, service: null, info: created };
    console.warn('GoogleSheetsService no está listo:', created.reason || created);
  }

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      google_sheets: gsWrapper.ready ? 'ready' : 'not_ready',
      info: gsWrapper.info,
    });
  });

  app.get('/products', async (req, res) => {
    if (!gsWrapper.ready) {
      return res.status(503).json({ ok: false, error: 'GoogleSheetsService not configured', info: gsWrapper.info });
    }
    try {
      const products = await gsWrapper.service.getProducts();
      res.json({ ok: true, count: products.length, data: products });
    } catch (err) {
      console.error('Error /products:', err);
      res.status(500).json({ ok: false, error: err.message || String(err) });
    }
  });

  app.get('/product/:id', async (req, res) => {
    if (!gsWrapper.ready) {
      return res.status(503).json({ ok: false, error: 'GoogleSheetsService not configured', info: gsWrapper.info });
    }
    try {
      const item = await gsWrapper.service.getProductById(req.params.id);
      if (!item) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, data: item });
    } catch (err) {
      console.error('Error /product/:id', err);
      res.status(500).json({ ok: false, error: err.message || String(err) });
    }
  });

  app.get('/search', async (req, res) => {
    if (!gsWrapper.ready) {
      return res.status(503).json({ ok: false, error: 'GoogleSheetsService not configured', info: gsWrapper.info });
    }
    try {
      const { q } = req.query;
      if (!q) return res.status(400).json({ ok: false, error: 'Parametro q es requerido' });
      const results = await gsWrapper.service.search(q, 200);
      res.json({ ok: true, count: results.length, data: results });
    } catch (err) {
      console.error('Error /search', err);
      res.status(500).json({ ok: false, error: err.message || String(err) });
    }
  });

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

main().catch(err => {
  console.error('Error fatal al iniciar app:', err);
  // No hacemos process.exit para evitar crash continuo en Railway; dejamos que el error esté en logs.
});
