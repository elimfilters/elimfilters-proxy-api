require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Google Sheets setup
let sheets;
let auth;

async function initializeGoogleSheets() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Google Sheets:', error.message);
  }
}

// Initialize on startup
initializeGoogleSheets();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    googleSheets: sheets ? 'connected' : 'disconnected'
  });
});

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'ELIMFILTERS API',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/api/products',
      '/api/products/:sku',
      '/api/search?q=keyword'
    ]
  });
});

// Get all products from Google Sheets
app.get('/api/products', async (req, res) => {
  try {
    if (!sheets) {
      return res.status(503).json({ 
        success: false,
        error: 'Google Sheets not initialized'
      });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Master!A2:Z', // Desde fila 2 hasta columna Z
    });

    const rows = response.data.values || [];
    
    // Convertir filas a objetos con el mapeo correcto
    const products = rows.map(row => ({
      query_norm: row[0] || '',
      sku: row[1] || '',
      oem_codes: row[2] || '',
      cross_reference: row[3] || '',
      filter_type: row[4] || '',
      media_type: row[5] || '',
      subtype: row[6] || '',
      engine_applications: row[7] || '',
      equipment_applications: row[8] || '',
      height_mm: row[9] || '',
      outer_diameter_mm: row[10] || '',
      thread_size: row[11] || '',
      gasket_od_mm: row[12] || '',
      gasket_id_mm: row[13] || '',
      bypass_valve_psi: row[14] || '',
      micron_rating: row[15] || '',
      duty: row[16] || '',
      iso_main_efficiency: row[17] || '',
      iso_test_method: row[18] || '',
      beta_200: row[19] || '',
      hydrostatic_burst_min_psi: row[20] || '',
      dirt_capacity_g: row[21] || '',
      rated_flow: row[22] || '',
      panel_width_mm: row[23] || '',
      panel_depth_mm: row[24] || '',
      created_at: row[25] || ''
    }));

    res.json({ 
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get product by SKU
app.get('/api/products/:sku', async (req, res) => {
  try {
    if (!sheets) {
      return res.status(503).json({ 
        success: false,
        error: 'Google Sheets not initialized'
      });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Master!A2:Z',
    });

    const rows = response.data.values || [];
    const sku = req.params.sku.toLowerCase();
    
    // Buscar por SKU (columna B, índice 1)
    const row = rows.find(r => r[1] && r[1].toLowerCase() === sku);
    
    if (!row) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found'
      });
    }

    const product = {
      query_norm: row[0] || '',
      sku: row[1] || '',
      oem_codes: row[2] || '',
      cross_reference: row[3] || '',
      filter_type: row[4] || '',
      media_type: row[5] || '',
      subtype: row[6] || '',
      engine_applications: row[7] || '',
      equipment_applications: row[8] || '',
      height_mm: row[9] || '',
      outer_diameter_mm: row[10] || '',
      thread_size: row[11] || '',
      gasket_od_mm: row[12] || '',
      gasket_id_mm: row[13] || '',
      bypass_valve_psi: row[14] || '',
      micron_rating: row[15] || '',
      duty: row[16] || '',
      iso_main_efficiency: row[17] || '',
      iso_test_method: row[18] || '',
      beta_200: row[19] || '',
      hydrostatic_burst_min_psi: row[20] || '',
      dirt_capacity_g: row[21] || '',
      rated_flow: row[22] || '',
      panel_width_mm: row[23] || '',
      panel_depth_mm: row[24] || '',
      created_at: row[25] || ''
    };

    res.json({ 
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Search products
app.get('/api/search', async (req, res) => {
  try {
    if (!sheets) {
      return res.status(503).json({ 
        success: false,
        error: 'Google Sheets not initialized'
      });
    }

    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ 
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Master!A2:Z',
    });

    const rows = response.data.values || [];
    const searchTerm = query.toLowerCase();
    
    // Buscar en múltiples campos
    const results = rows.filter(row => {
      const searchableText = [
        row[0], // query_norm
        row[1], // sku
        row[2], // oem_codes
        row[3], // cross_reference
        row[4], // filter_type
        row[7], // engine_applications
        row[8]  // equipment_applications
      ].join(' ').toLowerCase();
      
      return searchableText.includes(searchTerm);
    }).map(row => ({
      query_norm: row[0] || '',
      sku: row[1] || '',
      oem_codes: row[2] || '',
      cross_reference: row[3] || '',
      filter_type: row[4] || '',
      media_type: row[5] || '',
      subtype: row[6] || '',
      engine_applications: row[7] || '',
      equipment_applications: row[8] || '',
      height_mm: row[9] || '',
      outer_diameter_mm: row[10] || '',
      thread_size: row[11] || '',
      gasket_od_mm: row[12] || '',
      gasket_id_mm: row[13] || '',
      bypass_valve_psi: row[14] || '',
      micron_rating: row[15] || '',
      duty: row[16] || '',
      iso_main_efficiency: row[17] || '',
      iso_test_method: row[18] || '',
      beta_200: row[19] || '',
      hydrostatic_burst_min_psi: row[20] || '',
      dirt_capacity_g: row[21] || '',
      rated_flow: row[22] || '',
      panel_width_mm: row[23] || '',
      panel_depth_mm: row[24] || '',
      created_at: row[25] || ''
    }));

    res.json({ 
      success: true,
      count: results.length,
      query: query,
      data: results
    });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
