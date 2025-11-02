// =========================================
// googleSheetsConnector.js — v3.1.3
// ELIMFILTERS Proxy API
// =========================================

const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.auth = null;
  }

  // =============================
  // Inicializa conexión con Google Sheets
  // =============================
  async initialize() {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

      this.auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/spreadsheets'
        ],
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });

      console.log('✅ Google Sheets service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing Google Sheets:', error);
      throw error;
    }
  }

  // =============================
  // Carga todos los productos desde la hoja Master
  // =============================
  async getProducts() {
    try {
      if (!this.sheets) {
        await this.initialize();
      }

      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      const range = 'Master!A:Z';

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values;

      if (!rows || rows.length === 0) {
        console.warn('⚠️ Master sheet is empty');
        return [];
      }

      const headers = rows[0].map(h => h.trim());
      const products = rows.slice(1).map(row => {
        const product = {};
        headers.forEach((header, index) => {
          product[header] = row[index] || '';
        });
        return product;
      });

      console.log(`📦 Loaded ${products.length} products from Master`);
      return products;
    } catch (error) {
      console.error('❌ Error fetching products from Google Sheets:', error.message);
      throw error;
    }
  }

  // =============================
  // Búsqueda directa por código
  // =============================
  async searchInMaster(queryNorm) {
    try {
      if (!this.sheets) {
        await this.initialize();
      }

      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      const range = 'Master!A:Z';

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return { found: false };
      }

      const headers = rows[0];
      const normalizedQuery = queryNorm.toLowerCase().trim();

      const foundRow = rows.slice(1).find(row => {
        const queryNormValue = (row[0] || '').toLowerCase().trim();
        const skuValue = (row[1] || '').toLowerCase().trim();
        return queryNormValue === normalizedQuery || skuValue === normalizedQuery;
      });

      if (!foundRow) {
        return { found: false };
      }

      const product = {};
      headers.forEach((header, index) => {
        product[header] = foundRow[index] || '';
      });

      return { found: true, data: product };
    } catch (error) {
      console.error('❌ Error searching in Master:', error.message);
      throw error;
    }
  }

  // =============================
  // Obtiene las reglas de familia
  // =============================
  async getFamilyRules() {
    try {
      if (!this.sheets) {
        await this.initialize();
      }

      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      const range = 'FAMILY_RULES!A:G'; // pattern, duty, family, match_type, min, max, priority

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log('⚠️ No FAMILY_RULES found');
        return [];
      }

      const rules = rows.slice(1).map(row => ({
        pattern: row[0] || '',
        duty: row[1] || '',
        family: row[2] || '',
        match_type: row[3] || '',
        min: row[4] ? parseInt(row[4]) : null,
        max: row[5] ? parseInt(row[5]) : null,
        priority: row[6] ? parseInt(row[6]) : 0
      }));

      rules.sort((a, b) => b.priority - a.priority);
      console.log(`✅ Loaded ${rules.length} FAMILY_RULES`);
      return rules;
    } catch (error) {
      console.error('⚠️ Error fetching FAMILY_RULES:', error.message);
      return [];
    }
  }

  // =============================
  // Guarda un producto nuevo en Master
  // =============================
  async saveToMaster(productData) {
    try {
      if (!this.sheets) {
        await this.initialize();
      }

      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      const row = [
        productData.query_norm || '',
        productData.sku || '',
        productData.family || '',
        productData.duty || '',
        productData.oem_codes || '',
        productData.cross_reference || '',
        productData.filter_type || '',
        productData.media_type || '',
        productData.engine_applications || '',
        productData.equipment_applications || '',
        productData.height_mm || '',
        productData.outer_diameter_mm || '',
        productData.thread_size || '',
        productData.bypass_valve_psi || '',
        productData.micron_rating || '',
        productData.weight_grams || '',
        new Date().toISOString()
      ];

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Master!A:Z',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [row] }
      });

      console.log(`✅ Saved to Master: ${productData.sku}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error saving to Master:', error.message);
      throw error;
    }
  }
}

module.exports = GoogleSheetsService;
