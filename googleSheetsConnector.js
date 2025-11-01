// services/googleSheetsConnector.js
const { google } = require('googleapis');

class GoogleSheetsConnector {
  constructor(authClient, sheetId, sheetRange) {
    this.auth = authClient;
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.sheetId = sheetId;
    this.sheetRange = sheetRange || 'Master!A1:O';
  }

  // factory estático que server.js espera: await GoogleSheetsConnector.create()
  static async create() {
    // Leer credenciales desde GOOGLE_CREDENTIALS o GOOGLE_CREDENTIALS_BASE64
    let raw;
    if (process.env.GOOGLE_CREDENTIALS) {
      raw = process.env.GOOGLE_CREDENTIALS;
    } else if (process.env.GOOGLE_CREDENTIALS_BASE64) {
      raw = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
    }

    if (!raw) {
      throw new Error('Missing Google credentials. Set GOOGLE_CREDENTIALS or GOOGLE_CREDENTIALS_BASE64 in env.');
    }

    let creds;
    try {
      creds = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      throw new Error('Failed to parse GOOGLE_CREDENTIALS: ' + err.message);
    }

    // Crear cliente autenticado
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ]
    });

    const authClient = await auth.getClient();

    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error('Missing env GOOGLE_SHEET_ID');

    const sheetRange = process.env.SHEET_RANGE || 'Master!A1:O';

    return new GoogleSheetsConnector(authClient, sheetId, sheetRange);
  }

  // ejemplo: obtener todas las filas del rango
  async getValues() {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: this.sheetRange
    });
    return res.data.values || [];
  }

  // ejemplo: método para convertir filas en objetos (si tu app espera productos)
  async getProductsAsObjects() {
    const rows = await this.getValues();
    if (!rows || rows.length === 0) return [];

    const headers = rows[0].map(h => (h || '').toString().trim());
    const dataRows = rows.slice(1);
    return dataRows.map(row => {
      const obj = {};
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i] || `col${i}`] = row[i] !== undefined ? row[i] : '';
      }
      return obj;
    });
  }
}

module.exports = GoogleSheetsConnector;
