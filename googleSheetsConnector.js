const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.auth = null;
  }

  async initialize() {
    try {
      // Parse credentials from environment variable
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      
      // Create auth client
      this.auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      // Create sheets client
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      
      console.log('Google Sheets service initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Google Sheets:', error);
      throw error;
    }
  }

  async getProducts() {
    try {
      if (!this.sheets) {
        await this.initialize();
      }

      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      const range = 'Master!A:Z'; // Extended range to cover all columns
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        return [];
      }

      // First row contains headers
      const headers = rows[0];
      
      // Map rows to objects
      const products = rows.slice(1).map(row => {
        const product = {};
        headers.forEach((header, index) => {
          product[header] = row[index] || '';
        });
        return product;
      });

      return products;
    } catch (error) {
      console.error('Error fetching products from Google Sheets:', error);
      throw error;
    }
  }

  async searchProducts(query) {
    try {
      const products = await this.getProducts();
      
      if (!query) {
        return products;
      }

      const normalizedQuery = query.toLowerCase().trim();
      
      // Search across all relevant fields
      return products.filter(product => {
        return (
          (product.SKU && product.SKU.toLowerCase().includes(normalizedQuery)) ||
          (product['OEM Codes'] && product['OEM Codes'].toLowerCase().includes(normalizedQuery)) ||
          (product['Cross Reference'] && product['Cross Reference'].toLowerCase().includes(normalizedQuery)) ||
          (product['Filter Type'] && product['Filter Type'].toLowerCase().includes(normalizedQuery)) ||
          (product['Engine Applications'] && product['Engine Applications'].toLowerCase().includes(normalizedQuery)) ||
          (product['Equipment Applications'] && product['Equipment Applications'].toLowerCase().includes(normalizedQuery))
        );
      });
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }
}

module.exports = GoogleSheetsService;
