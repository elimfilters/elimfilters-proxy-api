// googleSheetsConnector.js v3.6.0 — Con soporte para hoja CrossReference
const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.auth = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  }

  async initialize() {
    try {
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

      if (!privateKey) {
        throw new Error('Variable GOOGLE_PRIVATE_KEY no encontrada');
      }
      
      if (!clientEmail) {
        throw new Error('Variable GOOGLE_SERVICE_ACCOUNT_EMAIL no encontrada');
      }

      this.auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey.replace(/\\n/g, '\n'),
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

  // 🆕 NUEVO: Buscar equivalencia en hoja CrossReference
  async findCrossReference(oemNumber) {
    if (!this.sheets || !this.spreadsheetId) return null;

    try {
      const range = 'CrossReference!A:E';
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      const rows = res.data.values || [];
      if (rows.length === 0) return null;

      const header = rows[0];
      const oemIndex = header.findIndex(h => h.toLowerCase().includes('oem'));
      const donaldsonIndex = header.findIndex(h => h.toLowerCase().includes('donaldson'));
      const framIndex = header.findIndex(h => h.toLowerCase().includes('fram'));
      const familyIndex = header.findIndex(h => h.toLowerCase().includes('family'));

      if (oemIndex === -1) return null;

      const normalized = oemNumber.toUpperCase().replace(/[-\s]/g, '');
      
      const matchRow = rows.find((r, i) => 
        i > 0 && r[oemIndex]?.toUpperCase().replace(/[-\s]/g, '') === normalized
      );

      if (!matchRow) return null;

      return {
        oem: matchRow[oemIndex] || '',
        donaldson: matchRow[donaldsonIndex] || '',
        fram: matchRow[framIndex] || '',
        family: matchRow[familyIndex] || ''
      };
    } catch (err) {
      console.error('⚠️ Error buscando en CrossReference:', err.message);
      return null;
    }
  }

  // 🆕 NUEVO: Guardar equivalencia en hoja CrossReference
  async saveCrossReference(oemNumber, donaldson, fram, family) {
    if (!this.sheets || !this.spreadsheetId) return;

    try {
      const range = 'CrossReference!A:E';
      
      // Verificar si ya existe
      const existing = await this.findCrossReference(oemNumber);
      if (existing) {
        console.log(`ℹ️ Equivalencia ya existe en CrossReference: ${oemNumber}`);
        return;
      }

      // Agregar nueva fila
      const newRow = [
        oemNumber,
        donaldson || '',
        fram || '',
        family || '',
        new Date().toISOString()
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: { values: [newRow] },
      });

      console.log(`💾 Equivalencia guardada en CrossReference: ${oemNumber} → ${donaldson || fram}`);
    } catch (err) {
      console.error('❌ Error guardando en CrossReference:', err.message);
    }
  }
}

module.exports = GoogleSheetsService;
