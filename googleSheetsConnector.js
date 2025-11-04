// googleSheetsConnector.js v3.3.6 — Con lectura JSON directa y validación robusta
const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.auth = null;
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
  }

  async initialize() {
    try {
      const rawCredentials = process.env.GOOGLE_CREDENTIALS;
      if (!rawCredentials) {
        throw new Error('Variable GOOGLE_CREDENTIALS no encontrada');
      }

      let credentials;
      try {
        credentials = JSON.parse(rawCredentials);
      } catch (err) {
        throw new Error('"GOOGLE_CREDENTIALS" no contiene JSON válido');
      }

      this.auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('✅ Conectado correctamente a Google Sheets');
    } catch (err) {
      console.error('❌ Error al inicializar Google Sheets:', err.message);
      throw err;
    }
  }

  async findRowByQuery(query) {
    if (!this.sheets || !this.spreadsheetId) return null;
    try {
      const range = 'Master!A:AZ';
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      const rows = res.data.values || [];
      const header = rows[0];
      const queryColIndex = header.findIndex(h => h.toLowerCase() === 'query_norm');
      if (queryColIndex === -1) return null;

      const row = rows.find((r, i) => i > 0 && r[queryColIndex] === query);
      if (!row) return null;

      return Object.fromEntries(header.map((h, i) => [h, row[i] || '']));
    } catch (err) {
      console.error('❌ Error buscando fila en Google Sheets:', err.message);
      return null;
    }
  }

  async replaceOrInsertRow(rowData) {
    if (!this.sheets || !this.spreadsheetId) return;
    try {
      const range = 'Master!A:AZ';
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      const rows = res.data.values || [];
      const header = rows[0];
      const queryIndex = header.findIndex(h => h.toLowerCase() === 'query_norm');
      if (queryIndex === -1) throw new Error('Columna query_norm no encontrada');

      const existingIndex = rows.findIndex(
        (r, i) => i > 0 && r[queryIndex] === rowData.query_norm
      );
      const rowArray = header.map(h => rowData[h] || '');

      if (existingIndex !== -1) {
        const rangeToUpdate = `Master!A${existingIndex + 1}:AZ${existingIndex + 1}`;
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: rangeToUpdate,
          valueInputOption: 'RAW',
          requestBody: { values: [rowArray] },
        });
        console.log(`🔁 Fila actualizada para ${rowData.query_norm}`);
      } else {
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range,
          valueInputOption: 'RAW',
          requestBody: { values: [rowArray] },
        });
        console.log(`✅ Fila agregada para ${rowData.query_norm}`);
      }
    } catch (err) {
      console.error('❌ Error insertando/actualizando fila:', err.message);
    }
  }
}

module.exports = GoogleSheetsService;
