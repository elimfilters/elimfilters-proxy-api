// googleSheetsConnector.js
// v3.0.0 – Sheets IO + respaldos (snapshot, audit)

const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheetId = process.env.GOOGLE_SHEET_ID;
    this.sheets = null;
    this.auth = null;
  }

  async initialize() {
    if (!this.sheetId) throw new Error('GOOGLE_SHEET_ID faltante');
    const creds = this.#loadCreds();
    this.auth = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    return true;
  }

  #loadCreds() {
    if (process.env.GOOGLE_SERVICE_ACCOUNT) {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    }
    // Variables sueltas
    const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const private_key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    if (!client_email || !private_key) {
      throw new Error('Credenciales de servicio Google faltantes');
    }
    return { client_email, private_key };
  }

  // ------------ Lectura/Escritura básicas ------------
  async readRange(a1) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: a1,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    return res.data.values || [];
  }

  async writeRange(a1, rows) {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: a1,
      valueInputOption: 'RAW',
      requestBody: { values: rows }
    });
  }

  async appendRows(a1, rows) {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.sheetId,
      range: a1,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows }
    });
  }

  async ensureHeaders(a1, headers) {
    const have = await this.readRange(a1);
    if (!have || have.length === 0) {
      await this.writeRange(a1, [headers]);
    }
  }

  // ------------ Respaldo / Auditoría ------------
  async createSnapshotTab() {
    const title = `SNAPSHOT_${new Date().toISOString().slice(0,10).replace(/-/g,'')}`;
    const meta = await this.sheets.spreadsheets.get({ spreadsheetId: this.sheetId });
    const tabs = (meta.data.sheets || []).map(s => s.properties.title);
    if (!tabs.includes(title)) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.sheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] }
      });
    }
    return title;
  }

  async snapshotMasterTo(title) {
    const src = process.env.SHEET_RANGE || 'Master!A:Z';
    const rows = await this.readRange(src);
    await this.writeRange(`${title}!A1`, rows);
    return { rows: rows.length };
  }

  async appendAudit(entry) {
    const TAB = 'AUDIT_LOG!A1';
    const headers = [
      'TIMESTAMP','EVENT','QUERY','CODE_TYPE','SKU','OEM','CrossRef',
      'FAMILY','DUTY','STATUS','SOURCE'
    ];
    await this.ensureHeaders(TAB, headers);
    const row = [[
      new Date().toISOString(),
      entry.event || 'CREATE',
      entry.query || '',
      entry.codeType || '',
      entry.SKU || '',
      entry.OEM || '',
      entry.CrossRef || '',
      entry.FAMILY || '',
      entry.DUTY || '',
      entry.STATUS || '',
      entry.SOURCE || 'API'
    ]];
    await this.appendRows(TAB, row);
  }
}

module.exports = GoogleSheetsService;
