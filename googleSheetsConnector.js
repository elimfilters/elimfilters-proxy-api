require('dotenv').config();
const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.sheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID || '';
    this.sheetName = process.env.SHEET_NAME || 'Master';
  }

  async initialize() {
    try {
      if (!process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
        throw new Error('Faltan variables de entorno de Google');
      }

      const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });

      console.log('✅ Google Sheets conectado correctamente');
    } catch (err) {
      console.error('❌ Error inicializando Google Sheets:', err.message);
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
      console.error('Error al leer rango:', error.message);
      return [];
    }
  }

  // ===== Métodos auxiliares seguros usados por server.js =====
  async findRowByQuery(query) {
    if (!this.sheets || !this.sheetId) return null;
    const range = `${this.sheetName}!A:Z`;
    try {
      const rows = await this.readRange(this.sheetId, range);
      if (!rows || rows.length === 0) return null;
      const headers = rows[0];
      const idxQueryNorm = headers.indexOf('query_norm');
      const idxSku = headers.indexOf('sku');
      const idxFamily = headers.indexOf('family');
      const idxDuty = headers.indexOf('duty');

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (idxQueryNorm !== -1 && r[idxQueryNorm] && r[idxQueryNorm].toString().toLowerCase() === query.toString().toLowerCase()) {
          return {
            sku: idxSku !== -1 ? r[idxSku] : undefined,
            family: idxFamily !== -1 ? r[idxFamily] : undefined,
            duty: idxDuty !== -1 ? r[idxDuty] : undefined,
            found: true
          };
        }
      }
      return null;
    } catch (e) {
      console.warn('GoogleSheetsService.findRowByQuery fallo:', e.message);
      return null;
    }
  }

  async findCrossReference(partNumber) {
    if (!this.sheets || !this.sheetId) return null;
    const range = `${this.sheetName}!A:Z`;
    try {
      const rows = await this.readRange(this.sheetId, range);
      if (!rows || rows.length <= 1) return null;
      const headers = rows[0];
      const idxOem = headers.indexOf('oem_number');
      const idxDonaldson = headers.indexOf('donaldson');
      const idxFram = headers.indexOf('fram');
      const idxFamily = headers.indexOf('family');

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (idxOem !== -1 && r[idxOem] && r[idxOem].toString().toUpperCase() === partNumber.toString().toUpperCase()) {
          return {
            oem_number: r[idxOem],
            donaldson: idxDonaldson !== -1 ? r[idxDonaldson] : undefined,
            fram: idxFram !== -1 ? r[idxFram] : undefined,
            family: idxFamily !== -1 ? r[idxFamily] : undefined
          };
        }
      }
      return null;
    } catch (e) {
      console.warn('GoogleSheetsService.findCrossReference fallo:', e.message);
      return null;
    }
  }

  async replaceOrInsertRow(data) {
    // Inserta al final (append) una fila con los campos más comunes
    if (!this.sheets || !this.sheetId) return false;
    const range = `${this.sheetName}!A:Z`;
    const row = [
      data.query_norm || '',
      data.sku || '',
      data.family || '',
      data.duty || '',
      data.oem_number || '',
      data.cross_brand || '',
      data.cross_part_number || ''
    ];
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] }
      });
      return true;
    } catch (e) {
      console.warn('GoogleSheetsService.replaceOrInsertRow fallo:', e.message);
      return false;
    }
  }

  async saveCrossReference(oem_number, donaldson, fram, family) {
    // Guarda una entrada básica de cross-reference
    if (!this.sheets || !this.sheetId) return false;
    const range = `${this.sheetName}!A:Z`;
    const row = [
      '', // query_norm
      '', // sku
      family || '',
      '', // duty
      oem_number || '',
      donaldson || '',
      fram || ''
    ];
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] }
      });
      return true;
    } catch (e) {
      console.warn('GoogleSheetsService.saveCrossReference fallo:', e.message);
      return false;
    }
  }
}

module.exports = GoogleSheetsService;
