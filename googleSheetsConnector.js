// googleSheetsConnector.js
const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
  }

  async initialize() {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    await auth.authorize();
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  // ejemplo de método usado por detection/business
  async getRange(range) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range,
    });
    return res.data.values || [];
  }
}

module.exports = GoogleSheetsService;
