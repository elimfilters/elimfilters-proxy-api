require('dotenv').config();
const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
  }

  async initialize() {
    try {
      // Validar que todas las variables estén cargadas
      if (!process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
        throw new Error("Faltan variables de entorno de Google");
      }

      const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });

      console.log("✅ Google Sheets conectado correctamente");
    } catch (err) {
      console.error("❌ Error inicializando Google Sheets:", err.message);
      throw err;
    }
  }

  async readRange(sheetId, range) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
      });
      return response.data.values;
    } catch (error) {
      console.error("Error al leer rango:", error.message);
      return [];
    }
  }
}

module.exports = GoogleSheetsService;
