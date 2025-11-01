// googleSheetsConnector.js
// Requiere: npm install googleapis
// Export: module.exports = GoogleSheetsService; module.exports.GoogleSheetsService = GoogleSheetsService;

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

  // Asegura y parsea las credenciales (string o objeto)
  static parseCredentials(creds) {
    if (!creds) {
      throw new Error('No credentials provided to parseCredentials');
    }

    if (typeof creds === 'string') {
      // Maneja tanto JSON en varias líneas como JSON con "\n" escapados
      const cleaned = creds.includes('\\n') ? creds.replace(/\\n/g, '\n') : creds;
      try {
        return JSON.parse(cleaned);
      } catch (err) {
        // Intenta parsear intentando remover BOM/espacios
        try {
          return JSON.parse(cleaned.trim());
        } catch (err2) {
          throw new Error('Invalid GOOGLE_CREDENTIALS JSON: ' + err2.message);
        }
      }
    }

    // Si ya es objeto
    if (typeof creds === 'object') {
      return creds;
    }

    throw new Error('Unsupported credentials format for parseCredentials');
  }

  // Inicializa el cliente googleapis (JWT) y el servicio sheets
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
      // require dinámico para evitar crash si la dependencia no está instalada
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

  // Helper: obtener valores de un rango (ej: "Master!A1:O1000" o "Master")
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
      const rows = res.data.values || [];
      return rows;
    } catch (err) {
      throw new Error('Error fetching sheet values: ' + (err.message || err));
    }
  }

  // Convierte una hoja (usando la primera fila como headers) en array de objetos
  // Por defecto leerá la hoja llamada "Master" y todo su rango.
  async getProducts(options = {}) {
    const sheetName = options.sheetName || 'Master';
    // lectura amplia para capturar todas las filas/columnas; ajusta si quieres limitar
    const range = `${sheetName}`;
    const rows = await this.getValues(range);

    if (!rows || rows.length === 0) return [];

    // Primera fila = headers
    const headers = rows[0].map(h => (h ? String(h).trim() : ''));

    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // ignore empty rows (all blank)
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

  // Método estático conveniente: crea e inicializa una instancia a partir de las env vars
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
