// server.js
// Servidor Express que expone endpoints básicos para productos desde Google Sheets.

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const GoogleSheetsService = require('./googleSheetsConnector');

const PORT = process.env.PORT || 3000;

function parseCredentialsEnv(envVar) {
  if (!envVar) return null;
  try {
    // Puede venir como JSON stringify o como multi-line JSON.
    return typeof envVar === 'object' ? envVar : JSON.parse(envVar);
  } catch (err) {
    // Intentar reparar líneas con comillas escapadas
    try {
      const repaired = envVar.replace(/\\n/g, '\n');
      return JSON.parse(repaired);
    } catch (e) {
      throw new Error('No se pudo parsear GOOGLE_CREDENTIALS: ' + e.message);
    }
  }
}

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  if (!process.env.GOOGLE_CREDENTIALS) {
    console.warn('WARNING: GOOGLE_CREDENTIALS no está configurado en las variables de entorno.');
  }
  if (!process.env.SHEET_ID) {
    console.warn('WARNING: SHEET_ID no está configurado en las variables de entorno.');
  }

  let credentials;
  try {
    credentials = parseCredentialsEnv(process.env.GOOGLE_CREDENTIALS);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const sheetId = process.env.SHEET_ID;
  if (!credentials || !sheetId) {
    console.error('Faltan GOOGLE_CREDENTIALS o SHEET_ID. No se puede arrancar el servicio.');
    process.exit(1);
  }

  const gsService = new GoogleSheetsService({ credentials, sheetId });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.get('/products', async (req, res) => {
    try {
      const products = await gsService.getProducts();
      res.json({ ok: true, count: products.length, data: products });
    } catch (err) {
      console.error('Error /products:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/product/:id', async (req, res) => {
    try {
      const item = await gsService.getProductById(req.params.id);
      if (!item) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, data: item });
    } catch (err) {
      console.error('Error /product/:id', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // /search?q=texto
  app.get('/search', async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.status(400).json({ ok: false, error: 'Parametro q es requerido' });
      const results = await gsService.search(q, 200);
      res.json({ ok: true, count: results.length, data: results });
    } catch (err) {
      console.error('Error /search', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

main().catch(err => {
  console.error('Fallo al iniciar la app:', err);
  process.exit(1);
});
