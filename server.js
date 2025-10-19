require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Google Sheets Setup
let sheets;
let auth;

async function initializeGoogleSheets() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
    
    auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets initialized');
  } catch (error) {
    console.error('❌ Google Sheets initialization failed:', error.message);
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({ 
    status: 'online',
    message: 'ELIMFILTERS API v1.0',
    endpoints: ['/api/products', '/api/search', '/api/filters']
  });
});

app.get('/api/products', async (req, res) => {
  try {
    if (!sheets) {
      return res.status(503).json({ error: 'Google Sheets not initialized' });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Master!A2:O',
    });

    const rows = response.data.values || [];
    const products = rows.map(row => ({
      id: row[0],
      name: row[1],
      category: row[2],
      price: row[3],
      stock: row[4],
      brand: row[5],
      model: row[6],
      description: row[7]
    }));

    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    console.error('Error fetching products:', error.message);
    res.status(500).json({ error: 'Failed to fetch products', details: error.message });
  }
});

app.post('/api/search', async (req, res) => {
  try {
    const { query, filters } = req.body;
    
    if (!sheets) {
      return res.status(503).json({ error: 'Google Sheets not initialized' });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Master!A2:O',
    });

    let rows = response.data.values || [];
    
    // Apply search query
    if (query) {
      const searchLower = query.toLowerCase();
      rows = rows.filter(row => 
        row.some(cell => cell && cell.toString().toLowerCase().includes(searchLower))
      );
    }

    // Apply filters
    if (filters) {
      if (filters.category) {
        rows = rows.filter(row => row[2] === filters.category);
      }
      if (filters.brand) {
        rows = rows.filter(row => row[5] === filters.brand);
      }
      if (filters.minPrice) {
        rows = rows.filter(row => parseFloat(row[3]) >= parseFloat(filters.minPrice));
      }
      if (filters.maxPrice) {
        rows = rows.filter(row => parseFloat(row[3]) <= parseFloat(filters.maxPrice));
      }
    }

    const products = rows.map(row => ({
      id: row[0],
      name: row[1],
      category: row[2],
      price: row[3],
      stock: row[4],
      brand: row[5],
      model: row[6],
      description: row[7]
    }));

    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    console.error('Error searching:', error.message);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

app.get('/api/filters', async (req, res) => {
  try {
    if (!sheets) {
      return res.status(503).json({ error: 'Google Sheets not initialized' });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Master!A2:O',
    });

    const rows = response.data.values || [];
    
    const categories = [...new Set(rows.map(row => row[2]).filter(Boolean))];
    const brands = [...new Set(rows.map(row => row[5]).filter(Boolean))];

    res.json({ 
      success: true, 
      filters: { categories, brands } 
    });
  } catch (error) {
    console.error('Error fetching filters:', error.message);
    res.status(500).json({ error: 'Failed to fetch filters', details: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
async function startServer() {
  await initializeGoogleSheets();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();
