// googleSheetsConnector.js (robusto) — sin clases, factory create()
'use strict';
const { google } = require('googleapis');

function normalizePem(raw) {
  if (!raw) throw new Error('GOOGLE_PRIVATE_KEY vacío');
  // Quita comillas envolventes y normaliza saltos
  let pk = String(raw).trim().replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
  pk = pk.replace(/\\n/g, '\n').replace(/\r/g, '');
  if (!pk.includes('BEGIN PRIVATE KEY') || !pk.includes('END PRIVATE KEY')) {
    throw new Error('PRIVATE_KEY sin cabecera/fin PEM. Revisa \\n y que no tenga comillas.');
  }
  return pk;
}

function pickCreds() {
  // 1) Base64 del JSON completo (recomendado)
  if (process.env.GOOGLE_SA_JSON_B64) {
    const raw = Buffer.from(process.env.GOOGLE_SA_JSON_B64, 'base64').toString('utf8');
    const j = JSON.parse(raw);
    return { client_email: j.client_email, private_key: j.private_key };
  }
  // 2) JSON plano en env (opcional)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const j = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    return { client_email: j.client_email, private_key: j.private_key };
  }
  // 3) Variables separadas (frágil, pero soportado)
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return { client_email: process.env.GOOGLE_CLIENT_EMAIL, private_key: process.env.GOOGLE_PRIVATE_KEY };
  }
  throw new Error('No hay credenciales: define GOOGLE_SA_JSON_B64 (recomendado) o GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY.');
}

function getSheetId() {
  return (
    process.env.GOOGLE_SHEET_ID ||
    process.env.SHEETS_SPREADSHEET_ID ||
    process.env.SHEET_ID ||
    ''
  );
}

async function create() {
  const spreadsheetId = getSheetId();
  if (!spreadsheetId) throw new Error('Falta GOOGLE_SHEET_ID/SHEETS_SPREADSHEET_ID.');
  const defaultRange = process.env.SHEET_RANGE || 'Master!A:Z';

  const { client_email, private_key } = pickCreds();
  const key = normalizePem(private_key);

  const auth = new google.auth.JWT({
    email: client_email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  await auth.authorize();

  const sheets = google.sheets({ version: 'v4', auth });

  return {
    async ping() {
      await sheets.spreadsheets.get({ spreadsheetId });
      return 'ok';
    },
    async read(range = defaultRange) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      return res.data.values || [];
    },
    async append(range = defaultRange, values = []) {
      const rows = Array.isArray(values?.[0]) ? values : [values];
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: rows },
      });
      return true;
    }
  };
}

module.exports = { create };
