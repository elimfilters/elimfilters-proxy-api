// googleSheetsConnector.js
const { google } = require('googleapis');

function getPrivateKey() {
  // Railway/GitHub Actions suelen guardar saltos de línea como \n
  return (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

async function create() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    getPrivateKey(),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const defaultRange = process.env.SHEET_RANGE || 'Master!A:Z';

  return {
    async ping() {
      // llamada ligera para validar credenciales
      await sheets.spreadsheets.get({ spreadsheetId });
      return 'ok';
    },
    async read(range = defaultRange) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      return res.data.values || [];
    },
    async append(range, values) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: { values }
      });
      return true;
    }
  };
}

module.exports = { create };
