// googleSheetsConnector.js
// Servicio para conectarse a Google Sheets y exponer utilidades básicas.
// Usa googleapis y espera recibir las credenciales (JSON) y el sheetId.

const { google } = require('googleapis');

class GoogleSheetsService {
  /**
   * @param {Object} options
   * @param {Object} options.credentials - JSON credentials object for service account
   * @param {string} options.sheetId - Google Sheet ID
   */
  constructor({ credentials, sheetId }) {
    if (!credentials) throw new Error('Google credentials are required');
    if (!sheetId) throw new Error('SHEET ID is required');
    this.credentials = credentials;
    this.sheetId = sheetId;
    this.sheets = null;
    this.headers = null; // populated on first fetch
  }

  async initializeAuth() {
    if (this.sheets) return;
    const auth = new google.auth.GoogleAuth({
      credentials: this.credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const authClient = await auth.getClient();
    this.sheets = google.sheets({ version: 'v4', auth: authClient });
  }

  // lee la hoja completa (A1:O) y construye objetos usando la fila de cabeceras (A1:O1)
  async fetchAllRows(range = 'Master!A1:O') {
    await this.initializeAuth();
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const values = res.data.values || [];
    if (values.length === 0) return { headers: [], rows: [] };

    const headers = values[0].map(h => (h || '').toString().trim());
    const rows = values.slice(1);
    return { headers, rows };
  }

  // mapea filas en objetos usando headers
  mapRowsToObjects(headers, rows) {
    return rows.map(row => {
      const obj = {};
      for (let i = 0; i < headers.length; i++) {
        const key = headers[i] || `col_${i}`;
        obj[key] = row[i] !== undefined ? row[i] : null;
      }
      return obj;
    });
  }

  // Obtiene todos los productos como array de objetos
  async getProducts() {
    const { headers, rows } = await this.fetchAllRows();
    this.headers = headers;
    return this.mapRowsToObjects(headers, rows);
  }

  // Busca un producto por id (busca columna 'id' o 'ID' o 'Id', si no existe usa la primera columna)
  async getProductById(id) {
    if (id === undefined || id === null) return null;
    const { headers, rows } = await this.fetchAllRows();
    const idHeaderIndex = (() => {
      if (!headers || headers.length === 0) return 0;
      const lower = headers.map(h => (h || '').toLowerCase());
      const idx = lower.indexOf('id');
      if (idx !== -1) return idx;
      const idx2 = lower.indexOf('sku');
      if (idx2 !== -1) return idx2;
      return 0;
    })();

    for (const row of rows) {
      const val = row[idHeaderIndex];
      if (val !== undefined && String(val) === String(id)) {
        // construir objeto según headers
        const obj = {};
        for (let i = 0; i < headers.length; i++) {
          const key = headers[i] || `col_${i}`;
          obj[key] = row[i] !== undefined ? row[i] : null;
        }
        return obj;
      }
    }
    return null;
  }

  // Búsqueda simple por texto en todas las columnas (case-insensitive)
  async search(query, limit = 50) {
    if (!query) return [];
    const q = String(query).toLowerCase();
    const { headers, rows } = await this.fetchAllRows();
    const objs = this.mapRowsToObjects(headers, rows);
    const results = objs.filter(obj => {
      return Object.values(obj).some(v => {
        if (v === null || v === undefined) return false;
        return String(v).toLowerCase().includes(q);
      });
    });
    return results.slice(0, limit);
  }
}

module.exports = GoogleSheetsService;
