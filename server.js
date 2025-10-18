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
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
let sheets;
let isInitialized = false;

async function initializeGoogleSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_CREDS_BASE64 
          ? Buffer.from(process.env.GOOGLE_SHEETS_CREDS_BASE64, 'base64').toString('utf-8')
          : process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    sheets = google.sheets({ version: 'v4', auth });
    isInitialized = true;
    console.log('✓ Google Sheets initialized');
  } catch (error) {
    console.error('Google Sheets init error:', error.message);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    initialized: isInitialized,
    timestamp: new Date().toISOString()
  });
});

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'ElimFilters API',
    version: '2.0.0',
    endpoints: ['/health', '/api/search', '/api/products']
  });
});

// Search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    if (!isInitialized) {
      return res.status(503).json({ error: 'Service not ready' });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'A:Z'
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];
    const data = rows.slice(1);

    // Simple search
    const results = data
      .filter(row => 
        row.some(cell => 
          cell && cell.toString().toLowerCase().includes(query.toLowerCase())
        )
      )
      .slice(0, 10)
      .map(row => {
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = row[i] || '';
        });
        return obj;
      });

    res.json({
      success: true,
      query,
      count: results.length,
      results
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get products
app.get('/api/products', async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({ error: 'Service not ready' });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'A:Z'
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];
    const data = rows.slice(1);

    const products = data.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] || '';
      });
      return obj;
    });

    res.json({
      success: true,
      count: products.length,
      products
    });

  } catch (error) {
    console.error('Products error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function start() {
  await initializeGoogleSheets();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ElimFilters API running on port ${PORT}`);
  });
}

start();
