// =========================================
// ELIMFILTERS Google Sheets Connector v4.0.0
// =========================================

const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;
    this.range = 'Master!A:Z';
  }

  // === Inicializar conexión con Google ===
  async initialize() {
    try {
      if (!process.env.GOOGLE_CREDENTIALS) {
        throw new Error('Faltan credenciales GOOGLE_CREDENTIALS');
      }

      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth: await this.auth.getClient() });
      console.log('✅ Google Sheets listo');
    } catch (err) {
      console.error('❌ Error al inicializar Google Sheets:', err.message);
      throw err;
    }
  }

  // === Buscar producto por código ===
  async findProduct(query) {
    try {
      console.log(`🔎 Buscando en hoja Master: ${query}`);
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: this.range,
      });

      const rows = res.data.values;
      if (!rows || rows.length < 2) return null;

      const headers = rows[0].map(h => h.toLowerCase());
      const dataRows = rows.slice(1);

      for (const row of dataRows) {
        const record = {};
        headers.forEach((h, i) => record[h] = row[i] || '');

        const candidates = [
          record['sku'],
          record['oem codes'],
          record['cross references'],
        ].filter(Boolean).map(v => v.toUpperCase());

        if (candidates.some(v => v.includes(query))) {
          console.log(`✅ Registro encontrado: ${record['sku']}`);
          return record;
        }
      }

      console.log(`⚠️ No se encontró el código ${query} en la hoja Master`);
      return null;
    } catch (error) {
      console.error('❌ Error buscando producto:', error.message);
      throw error;
    }
  }

  // === Agregar producto nuevo ===
  async addProduct(result) {
    try {
      const {
        query, family, duty, source,
        homologated_sku, final_sku
      } = result;

      const newRow = [
        final_sku,
        family,
        duty,
        source,
        query,
        homologated_sku,
        '', '', '', '', // Reservado para OEM Codes, Cross, Engine, Equipment
        '', '', '', '', // Especificaciones
        new Date().toISOString()
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: this.range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [newRow] },
      });

      console.log(`🟢 Nuevo SKU agregado a hoja Master: ${final_sku}`);
    } catch (error) {
      console.error('❌ Error agregando producto:', error.message);
      throw error;
    }
  }
}

module.exports = GoogleSheetsService;
