// googleSheetsConnector.js
// Requiere: npm install googleapis
// Export compatible con ambos estilos: default y named export

class GoogleSheetsService {
  /**
   * Constructor opcional:
   * - options.sheetId
   * - options.credentials (objeto JSON o string JSON)
   */
  constructor(options = {}) {
    this.sheetId = options.sheetId || process.env.SHEET_ID || null;
    const rawCreds = options.credentials || process.env.GOOGLE_CREDENTIALS || null;
    this.credentials = rawCreds ? GoogleSheetsService.parseCredentials(rawCreds) : null;

    this.authClient = null;
    this.sheets = null;
    this.inited = false;
  }

  // parseCredentials robusto: intenta varios arreglos comunes de formato
  static parseCredentials(creds) {
    if (!creds) {
      throw new Error('No credentials provided to parseCredentials');
    }

    if (typeof creds === 'string') {
      // 1) intento directo
      try {
        return JSON.parse(creds);
      } catch (e1) {
        // 2) si falla, puede haber saltos reales -> convertirlos a "\n" y reintentar
        try {
          const fix1 = creds.replace(/\r\n/g, '\\n').replace(/\n/g, '\\n');
          return JSON.parse(fix1);
        } catch (e2) {
          // 3) también puede que tengamos \n escapados que deben ser reales
          try {
            const fix2 = creds.replace(/\\n/g, '\n');
            return JSON.parse(fix2);
          } catch (e3) {
            throw new Error('Invalid GOOGLE_CREDENTIALS JSON: ' + (e3.message || e2.message || e1.message));
          }
        }
      }
    }

    if (typeof creds === 'object') return creds;
    throw new Error('Unsupported credentials format for parseCredentials');
  }

  // Inicializa googleapis (JWT) y crea cliente sheets
  async init() {
    if (this.inited) return this;

    if (!this.credentials) {
      throw new Error('GoogleSheetsService.init: missing credentials');
    }
    if (!this.sheetId) {
      throw new Error('GoogleSheetsService.init: missing sheetId (SHEET_ID)');
    }

    let google;
    try {
      ({ google } = require('googleapis'));
    } catch (err) {
      throw new Error('googleapis module is not installed. Run: npm install googleapis');
    }

    const jwt = new google.auth.JWT(
      this.credentials.client_email,
      null,
      this.credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    try {
      await jwt.authorize();
    } catch (err) {
      throw new Error('Failed to authorize JWT: ' + (err.message || err));
    }

    this.authClient = jwt;
    this.sheets = google.sheets({ version: 'v4', auth: jwt });
    this.inited = true;
    return this;
  }

  // Obtener valores de un rango (ej: "Master!A1:O1000" o "Master")
  async getValues(range) {
    if (!this.inited) {
      await this.init();
    }
    if (!this.sheets) {
      throw new Error('GoogleSheetsService.getValues: sheets client not initialized');
    }
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range,
      });
      return res.data.values || [];
    } catch (err) {
      throw new Error('Error fetching sheet values: ' + (err.message || err));
    }
  }

  // Convierte la hoja (primera fila = headers) en array de objetos
  async getProducts(options = {}) {
    const sheetName = options.sheetName || 'Master';
    const range = `${sheetName}`;
    const rows = await this.getValues(range);

    if (!rows || rows.length === 0) return [];

    const headers = rows[0].map(h => (h ? String(h).trim() : ''));

    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const allBlank = row.every(cell => !cell || String(cell).trim() === '');
      if (allBlank) continue;

      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c] || `col_${c}`;
        obj[key] = row[c] !== undefined ? row[c] : '';
      }
      data.push(obj);
    }
    return data;
  }

  // Crea e inicializa una instancia desde las env vars
  static async initializeAuthFromEnv() {
    const sheetId = process.env.SHEET_ID;
    const raw = process.env.GOOGLE_CREDENTIALS;
    if (!raw || !sheetId) {
      throw new Error('No hay GOOGLE_CREDENTIALS o SHEET_ID en las env vars');
    }
    const svc = new GoogleSheetsService({ sheetId, credentials: raw });
    await svc.init();
    return svc;
  }
}

// Export compatible con ambos estilos de require:
// - const GoogleSheetsService = require('./googleSheetsConnector');
// - const { GoogleSheetsService } = require('./googleSheetsConnector');
module.exports = GoogleSheetsService;
module.exports.GoogleSheetsService = GoogleSheetsService;
