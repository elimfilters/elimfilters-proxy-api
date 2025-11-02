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
        return [];
      }

      const headers = rows[0];
      
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
      
      // Buscar en query_norm (columna A) y SKU (columna B)
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
      console.error('Error searching in Master:', error);
      throw error;
    }
  }

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

      const headers = rows[0];
      
      const rules = rows.slice(1).map(row => ({
        pattern: row[0] || '',
        duty: row[1] || '',
        family: row[2] || '',
        match_type: row[3] || '',
        min: row[4] ? parseInt(row[4]) : null,
        max: row[5] ? parseInt(row[5]) : null,
        priority: row[6] ? parseInt(row[6]) : 0
      }));

      // Ordenar por prioridad (mayor a menor)
      rules.sort((a, b) => b.priority - a.priority);

      console.log(`✅ Loaded ${rules.length} FAMILY_RULES`);
      return rules;
    } catch (error) {
      console.error('⚠️ Error fetching FAMILY_RULES (sheet may not exist):', error.message);
      return [];
    }
  }

  async saveToMaster(productData) {
    try {
      if (!this.sheets) {
        await this.initialize();
      }

      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      
      // Preparar los datos en el orden correcto de las columnas
      const row = [
        productData.query_norm || '',
        productData.sku || '',
        productData.oem_codes || '',
        productData.cross_reference || '',
        productData.filter_type || '',
        productData.media_type || '',
        productData.subtype || '',
        productData.engine_applications || '',
        productData.equipment_applications || '',
        productData.height_mm || '',
        productData.outer_diameter_mm || '',
        productData.thread_size || '',
        productData.gasket_od_mm || '',
        productData.gasket_id_mm || '',
        productData.bypass_valve_psi || '',
        productData.micron_rating || '',
        productData.duty || '',
        productData.iso_main_efficiency || '',
        productData.iso_test_method || '',
        productData.beta_200 || '',
        productData.hydrostatic_burst_min_psi || '',
        productData.dirt_capacity_g || '',
        productData.rated_flow || '',
        productData.panel_width_mm || '',
        productData.panel_depth_mm || '',
        new Date().toISOString()
      ];

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Master!A:Z',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [row]
        }
      });

      console.log(`✅ Saved to Master: ${productData.sku}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error saving to Master:', error);
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
