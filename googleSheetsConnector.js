// googleSheetsConnector.js — Google Sheets RW
const { google } = require('googleapis');

class GoogleSheetsService {
  async initialize() {
    const credsRaw = process.env.GOOGLE_CREDENTIALS;
    if (!credsRaw) throw new Error('GOOGLE_CREDENTIALS ausente');

    const creds = JSON.parse(credsRaw);
    if (creds.private_key) {
      creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }

    // RW para poder crear filas
    this.jwt = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    await this.jwt.authorize();

    this.sheets = google.sheets({ version: 'v4', auth: this.jwt });
    this.sheetId = process.env.GOOGLE_SHEET_ID;
    if (!this.sheetId) throw new Error('GOOGLE_SHEET_ID ausente');
  }
}

module.exports = GoogleSheetsService;
