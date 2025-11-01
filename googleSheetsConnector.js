// googleSheetsConnector.js
// Implementación minimal y robusta de GoogleSheetsService (CommonJS)
// Requiere: "googleapis" en package.json

const { google } = require('googleapis');

class GoogleSheetsService {
  constructor(options = {}) {
    this.sheetId = process.env.SHEET_ID || options.sheetId;
    this.sheetRange = process.env.SHEET_RANGE || options.sheetRange || 'Master!A1:Z';
    this.credsRaw = process.env.GOOGLE_CREDENTIALS || options.googleCredentials;
    this.client = null;
    this.sheets = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    if (!this.credsRaw) {
      throw new Error('GOOGLE_CREDENTIALS no configurado (env GOOGLE_CREDENTIALS)');
    }
    // Accept either raw JSON or base64-encoded JSON
    let creds;
    try {
      creds = JSON.parse(this.credsRaw);
    } catch (err) {
      // try base64 decode
      try {
        creds = JSON.parse(Buffer.from(this.credsRaw, 'base64').toString('utf8'));
      } catch (err2) {
        throw new Error('No se pudo parsear GOOGLE_CREDENTIALS (JSON o base64 esperado)');
      }
    }

    const clientEmail = creds.client_email;
    const privateKey = creds.private_key;

    if (!clientEmail || !privateKey) {
      throw new Error('GOOGLE_CREDENTIALS inválido: faltan client_email o private_key');
    }

    // Replace literal \n if key was pasted with escaped newlines
    const fixedPrivateKey = privateKey.replace(/\\n/g, '\n');

    this.client = new google.auth.JWT({
      email: clientEmail,
      key: fixedPrivateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // authorize
    await this.client.authorize();

    this.sheets = google.sheets({ version: 'v4', auth: this.client });
    this.initialized = true;
  }

  // Devuelve valores en formato array de arrays
  async getValues(range = null) {
    await this.initialize();
    const r = range || this.sheetRange;
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: r,
    });
    return res.data.values || [];
  }

  // Ejemplo: obtener encabezados (primera fila)
  async getHeaders() {
    const vals = await this.getValues(this.sheetRange.split('!')[0] + '!1:1');
    return vals[0] || [];
  }

  // Ejemplo: obtener productos (puedes adaptar a tus necesidades)
  async getProducts({ limit = 100, offset = 0 } = {}) {
    const values = await this.getValues(this.sheetRange);
    // values: array de filas; primero es header
    if (values.length <= 1) return [];
    const headers = values[0];
    const rows = values.slice(1);
    const items = rows.map(row => {
      const obj = {};
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]] = row[i] !== undefined ? row[i] : null;
      }
      return obj;
    });
    // aplicar limit/offset
    return items.slice(offset, offset + limit);
  }
}

module.exports = GoogleSheetsService;
