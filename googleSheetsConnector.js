const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.auth = null;
  }

  async initialize() {
    try {
      // Intentar leer credenciales desde GOOGLE_SHEETS_CREDS_BASE64 o GOOGLE_CREDENTIALS
      let credentials;
      
      if (process.env.GOOGLE_SHEETS_CREDS_BASE64) {
        const base64Creds = process.env.GOOGLE_SHEETS_CREDS_BASE64;
        const jsonCreds = Buffer.from(base64Creds, 'base64').toString('utf-8');
        credentials = JSON.parse(jsonCreds);
      } else if (process.env.GOOGLE_CREDENTIALS) {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      } else {
        throw new Error('No se encontraron credenciales de Google Sheets');
      }

      this.auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('✅ Google Sheets initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing Google Sheets:', error.message);
      throw error;
    }
  }

  async getProducts() {
    try {
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      const range = 'Master!A2:O'; // Cambiado de Products a Master

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      
      const products = rows.map(row => ({
        query_norm: row[0] || '',
        sku: row[1] || '',
        oem_codes: row[2] || '',
        cross_reference: row[3] || '',
        filter_type: row[4] || '',
        media_type: row[5] || '',
        subtype: row[6] || '',
        engine_applications: row[7] || '',
        equipment: row[8] || '',
        applications: row[9] || '',
        height_mm: row[10] || '',
        outer_diameter_mm: row[11] || '',
        thread_size: row[12] || '',
        gasket_od_mm: row[13] || '',
        gasket_id_mm: row[14] || '',
      }));

      return products;
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  }

  async searchProducts(query) {
    try {
      const products = await this.getProducts();
      const normalizedQuery = query.toLowerCase().trim();

      return products.filter(product => {
        return (
          product.query_norm.toLowerCase().includes(normalizedQuery) ||
          product.sku.toLowerCase().includes(normalizedQuery) ||
          product.oem_codes.toLowerCase().includes(normalizedQuery) ||
          product.cross_reference.toLowerCase().includes(normalizedQuery)
        );
      });
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }

  async getProductByOEM(oemCode) {
    try {
      const products = await this.getProducts();
      const normalizedOEM = oemCode.toLowerCase().trim();

      return products.find(product => 
        product.oem_codes.toLowerCase().includes(normalizedOEM)
      );
    } catch (error) {
      console.error('Error getting product by OEM:', error);
      throw error;
    }
  }
}

module.exports = GoogleSheetsService;
