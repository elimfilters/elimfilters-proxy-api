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
      '/api/products/:id'
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
      range: 'Master!A2:O', // Desde fila 2 hasta columna O (asumiendo fila 1 son headers)
    });

    const rows = response.data.values || [];
    
    // Convertir filas a objetos
    const products = rows.map(row => ({
      id: row[0] || '',
      name: row[1] || '',
      brand: row[2] || '',
      category: row[3] || '',
      subcategory: row[4] || '',
      partNumber: row[5] || '',
      description: row[6] || '',
      price: row[7] || '',
      stock: row[8] || '',
      image: row[9] || '',
      specifications: row[10] || '',
      compatibility: row[11] || '',
      weight: row[12] || '',
      dimensions: row[13] || '',
      notes: row[14] || ''
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

// Get product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    if (!sheets) {
      return res.status(503).json({ 
        success: false,
        error: 'Google Sheets not initialized'
      });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Master!A2:O',
    });

    const rows = response.data.values || [];
    const productId = req.params.id;
    
    const row = rows.find(r => r[0] === productId);
    
    if (!row) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found'
      });
    }

    const product = {
      id: row[0] || '',
      name: row[1] || '',
      brand: row[2] || '',
      category: row[3] || '',
      subcategory: row[4] || '',
      partNumber: row[5] || '',
      description: row[6] || '',
      price: row[7] || '',
      stock: row[8] || '',
      image: row[9] || '',
      specifications: row[10] || '',
      compatibility: row[11] || '',
      weight: row[12] || '',
      dimensions: row[13] || '',
      notes: row[14] || ''
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
