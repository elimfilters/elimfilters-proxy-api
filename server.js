// server.js — Entry Point with Scraping and Sheets Integration
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { detectFilter, setSheetsInstance } = require('./detectionService');
const { getPrivateKey } = require('./utils/secureKey');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const ADMIN_KEY = process.env.ADMIN_KEY;
const WORDPRESS_URL = process.env.WORDPRESS_URL || '*';

// ===================================
// 🛠️ RUTA DE HEALTHCHECK
// CRÍTICA: Responde 200 OK inmediatamente.
// ===================================
app.get('/health', (req, res) => {
    // Si el healthcheck funciona, significa que la aplicación está viva.
    res.status(200).send('OK');
});
// ===================================

// Middlewares
app.use(cors({ origin: WORDPRESS_URL }));
app.use(morgan('dev'));
app.use(bodyParser.json());


// Google Sheets Auth Setup
const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  getPrivateKey(),
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Master';

// Sheets Helper Instance
const sheetsInstance = {
  async findCrossReference(oem) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!D2:G`,
    });
    const rows = res.data.values || [];
    for (const row of rows) {
      if (row.includes(oem)) {
        return { donaldson: row[1], fram: row[2] };
      }
    }
    return null;
  },

  async replaceOrInsertRow(data) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:A`,
    });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === data.sku);
    const values = [[
      data.sku,
      data.filter_type,
      data.duty,
      data.oem_code,
      data.source_code,
      data.source,
      data.cross_reference.join(', '),
      data.oem_codes.join(', '),
      data.engine_applications.join('; '),
      data.equipment_applications.join('; '),
      '', '', '', // reserved for flow, life, interval
      data.description,
      '', '', '', '', // reserved for fuel-specific
      new Date().toISOString()
    ]];

    const targetRange = `${SHEET_NAME}!A${rowIndex + 2}`;
    if (rowIndex >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: targetRange,
        valueInputOption: 'RAW',
        requestBody: { values },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A2`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values },
      });
    }
  },
};

setSheetsInstance(sheetsInstance);

// Endpoint Principal
app.post('/api/detect', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ status: 'ERROR', message: 'Missing query' });
  try {
    const result = await detectFilter(query, sheetsInstance);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// Endpoint Admin
app.post('/api/admin/update', async (req, res) => {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(403).json({ status: 'FORBIDDEN' });
  return res.json({ status: 'OK', message: 'Admin endpoint working' });
});

// ===================================
// 🛠️ SOLUCIÓN FINAL: Añadir un retraso de 4 segundos (4000ms)
// Este retraso garantiza que el sistema operativo del contenedor esté listo
// para la conexión antes de que se inicie la escucha del puerto.
// ===================================
setTimeout(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server listening on 0.0.0.0:${PORT} after 4s delay.`);
    });
}, 4000); // Retraso de 4 segundos
// ===================================
