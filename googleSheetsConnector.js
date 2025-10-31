// googleSheetsConnector.js
'use strict';

const { google } = require('googleapis');

/** Devuelve la private key con saltos \n normalizados */
function getPrivateKey() {
  return (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

/** Devuelve el ID del Spreadsheet desde las envs aceptadas */
function getSheetId() {
  return (
    process.env.GOOGLE_SHEET_ID ||
    process.env.SHEETS_SPREADSHEET_ID || // compat
    process.env.SHEET_ID ||               // compat
    ''
  );
}

/**
 * Factory: crea y devuelve un conector listo para usar (NO es clase).
 * Uso:
 *   const sheets = await require('./googleSheetsConnector').create();
 *   await sheets.ping();
 */
async function create() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey  = getPrivateKey();
  const spreadsheetId = getSheetId();
  const defaultRange  = process.env.SHEET_RANGE || 'Master!A:Z';

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error('Faltan GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY o GOOGLE_SHEET_ID');
  }

  const auth = new google.auth.JWT(
    clientEmail,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  await auth.authorize();

  const sheets = google.sheets({ version: 'v4', auth });

  return {
    /** Valida credenciales y acceso al Spreadsheet */
    async ping() {
      await sheets.spreadsheets.get({ spreadsheetId });
      return 'ok';
    },

    /** Lee un rango (A1) del Spreadsheet */
    async read(range = defaultRange) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      return res.data.values || [];
    },

    /** Agrega filas a un rango (A1) */
    async append(range = defaultRange, values = []) {
      const rows = Array.isArray(values[0]) ? values : [values];
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
