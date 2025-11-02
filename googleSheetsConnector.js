const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.auth = null;
  }

  async initialize() {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
        ],
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('✅ Google Sheets service initialized');
    } catch (error) {
      console.error('❌ Google Sheets initialization failed:', error.message);
      throw error;
    }
  }

  async getSheetData(range = 'Master!A:AH') {
    try {
      if (!this.sheets) await this.initialize();

      const spreadsheetId = process.env.GOOGLE_SHEETS_ID; // ✅ corregido
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) return [];

      const headers = rows[0];
      return rows.slice(1).map(row =>
        Object.fromEntries(headers.map((h, i) => [h.trim(), row[i] || '']))
      );
    } catch (error) {
      console.error('❌ Error reading Google Sheet:', error.message);
      throw error;
    }
  }

  // 🔍 búsqueda avanzada
  async findBySKUorOEM(query) {
    try {
      const data = await this.getSheetData();
      const q = query.toLowerCase().trim();

      const match = data.find(item => {
        return (
          (item.sku && item.sku.toLowerCase() === q) ||
          (item.oem_codes && item.oem_codes.toLowerCase().includes(q)) ||
          (item.cross_reference && item.cross_reference.toLowerCase().includes(q))
        );
      });

      return match || null;
    } catch (error) {
      console.error('❌ Error in findBySKUorOEM:', error.message);
      throw error;
    }
  }
}

module.exports = GoogleSheetsService;
