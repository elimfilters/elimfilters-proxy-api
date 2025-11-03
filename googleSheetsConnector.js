// =========================================
// ELIMFILTERS Google Sheets Connector v4.1.0
// Compatible 100% con estructura Master inamovible
// =========================================

const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;
    this.range = 'Master!A:AJ'; // columnas hasta "description"
  }

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
      console.log('✅ Google Sheets conectado (estructura Master protegida)');
    } catch (err) {
      console.error('❌ Error al inicializar Google Sheets:', err.message);
      throw err;
    }
  }

  // === Buscar producto existente ===
  async findProduct(query) {
    try {
      console.log(`🔎 Buscando ${query} en Master...`);
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: this.range,
      });

      const rows = res.data.values;
      if (!rows || rows.length < 2) return null;

      const headers = rows[0].map(h => h.trim().toLowerCase());
      const dataRows = rows.slice(1);

      for (const row of dataRows) {
        const record = {};
        headers.forEach((h, i) => record[h] = row[i] || '');

        const candidates = [
          record['query_norm'],
          record['sku'],
          record['oem_codes'],
          record['cross_reference']
        ].filter(Boolean).map(v => v.toUpperCase());

        if (candidates.some(v => v.includes(query.toUpperCase()))) {
          console.log(`✅ Registro encontrado en Master: ${record['sku']}`);
          return record;
        }
      }

      console.log(`⚠️ No existe ${query} en Master`);
      return null;
    } catch (error) {
      console.error('❌ Error en findProduct:', error.message);
      throw error;
    }
  }

  // === Insertar nuevo SKU ===
  async addProduct(result) {
    try {
      console.log(`📝 Agregando nuevo SKU ${result.final_sku} a Master...`);

      const now = new Date().toISOString();
      const newRow = [
        result.query || '',              // query_norm
        result.final_sku || '',          // sku
        result.family || '',             // family
        result.duty || '',               // duty
        '',                              // oem_codes
        '',                              // cross_reference
        '', '', '',                      // filter_type, media_type, subtype
        '', '',                          // engine_applications, equipment_applications
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', // specs vacíos
        '', '', '', '', '', '', '', '', '', '', '', '',         // hasta weight_grams
        'AUTO-GENERATED',                // category
        '',                              // name
        `Generated automatically ${now}` // description
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: this.range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [newRow] },
      });

      console.log(`✅ Nuevo SKU insertado: ${result.final_sku}`);
    } catch (error) {
      console.error('❌ Error agregando producto:', error.message);
      throw error;
    }
  }
}

module.exports = GoogleSheetsService;
