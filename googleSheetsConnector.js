// googleSheetsConnector.js
const { google } = require('googleapis');

function getCredsFromEnv() {
  const b64 = process.env.GOOGLE_SA_JSON_B64;
  if (!b64) throw new Error('GOOGLE_SA_JSON_B64 no está definida');
  const json = Buffer.from(b64, 'base64').toString('utf8');
  return JSON.parse(json);
}

function getAuth() {
  const credentials = getCredsFromEnv();
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheets() {
  const auth = getAuth();
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

module.exports = { getSheets };
