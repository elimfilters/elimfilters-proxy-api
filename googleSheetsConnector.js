'use strict';

const { google } = require('googleapis');
const fs = require('fs');

class GoogleSheetsService {
  /**
   * opts:
   *  - clientEmail
   *  - privateKey
   *  - credentialsPath  (ruta a JSON de service account)
   */
  constructor(opts = {}) {
    this.scopes = ['https://www.googleapis.com/auth/spreadsheets'];
    this.auth = null;
    this.sheets = null;

    this.clientEmail =
      opts.clientEmail || process.env.GS_CLIENT_EMAIL || null;

    this.privateKey =
      opts.privateKey || process.env.GS_PRIVATE_KEY || null;

    this.credentialsPath =
      opts.credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS || null;
  }

  async initialize() {
    if (this.sheets) return this.sheets;

    const creds = await this.#loadCredentials();
    this.auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: this.scopes,
    });
    await this.auth.authorize();

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    return this.sheets;
  }

  async #loadCredentials() {
    // 1) Variables directas
    if (this.clientEmail && this.privateKey) {
      return {
        client_email: this.clientEmail,
        private_key: this.privateKey.replace(/\\n/g, '\n'),
      };
    }

    // 2) Archivo en GOOGLE_APPLICATION_CREDENTIALS
    if (this.credentialsPath && fs.existsSync(this.credentialsPath)) {
      const raw = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
      return {
        client_email: raw.client_email,
        private_key: (raw.private_key || '').replace(/\\n/g, '\n'),
      };
    }

    // 3) JSON en variable (opcional)
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      const raw = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      return {
        client_email: raw.client_email,
        private_key: (raw.private_key || '').replace(/\\n/g, '\n'),
      };
    }

    throw new Error('Credenciales de Google no configuradas');
  }

  // ===== Métodos de uso común =====

  async getValues(spreadsheetId, range) {
    await this.initialize();
    const res = await this.sheets.spreadsheets.values.get({ spreadsheetId, range });
    return res.data.values || [];
  }

  async appendValues(spreadsheetId, range, rows) {
    await this.initialize();
    const values = Array.isArray(rows?.[0]) ? rows : [rows];
    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    return res.data.updates || null;
  }

  async batchGet(spreadsheetId, ranges) {
    await this.initialize();
    const res = await this.sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges });
    return res.data.valueRanges || [];
  }

  async batchUpdate(spreadsheetId, requests) {
    await this.initialize();
    const res = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
    return res.data;
  }
}

module.exports = GoogleSheetsService;
