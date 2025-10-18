const { google } = require('googleapis');

class GoogleSheetsService {
    constructor() {
        this.sheets = null;
        this.auth = null;
        this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
        this.sheetName = 'Master';
    }

    async initialize() {
        try {
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
            
            this.auth = new google.auth.GoogleAuth({
                credentials: credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            
            console.log('✅ Google Sheets initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing Google Sheets:', error.message);
            throw error;
        }
    }

    async getProducts() {
        try {
            const range = `${this.sheetName}!A2:P`;
            
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: range,
            });

            const rows = response.data.values || [];
            
            return rows.map((row, index) => ({
                id: index + 1,
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
                bypass_valve_psi: row[15] || ''
            }));
        } catch (error) {
            console.error('Error fetching products:', error.message);
            throw error;
        }
    }

    async searchProducts(query) {
        try {
            const products = await this.getProducts();
            const searchTerm = query.toLowerCase().trim();
            
            return products.filter(product => {
                return (
                    product.query_norm?.toLowerCase().includes(searchTerm) ||
                    product.sku?.toLowerCase().includes(searchTerm) ||
                    product.oem_codes?.toLowerCase().includes(searchTerm) ||
                    product.cross_reference?.toLowerCase().includes(searchTerm) ||
                    product.filter_type?.toLowerCase().includes(searchTerm) ||
                    product.equipment?.toLowerCase().includes(searchTerm) ||
                    product.applications?.toLowerCase().includes(searchTerm)
                );
            });
        } catch (error) {
            console.error('Error searching products:', error.message);
            throw error;
        }
    }

    async getProductByOEM(oemCode) {
        try {
            const products = await this.getProducts();
            const searchCode = oemCode.toLowerCase().trim();
            
            return products.find(product => 
                product.oem_codes?.toLowerCase().includes(searchCode)
            );
        } catch (error) {
            console.error('Error fetching product by OEM:', error.message);
            throw error;
        }
    }

    async addProduct(productData) {
        try {
            const values = [[
                productData.query_norm || '',
                productData.sku || '',
                productData.oem_codes || '',
                productData.cross_reference || '',
                productData.filter_type || '',
                productData.media_type || '',
                productData.subtype || '',
                productData.engine_applications || '',
                productData.equipment || '',
                productData.applications || '',
                productData.height_mm || '',
                productData.outer_diameter_mm || '',
                productData.thread_size || '',
                productData.gasket_od_mm || '',
                productData.gasket_id_mm || '',
                productData.bypass_valve_psi || ''
            ]];

            const response = await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A:P`,
                valueInputOption: 'USER_ENTERED',
                resource: { values }
            });

            return response.data;
        } catch (error) {
            console.error('Error adding product:', error.message);
            throw error;
        }
    }
}

module.exports = GoogleSheetsService;
