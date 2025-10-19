require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { google } = require('googleapis');
const businessLogic = require('./businessLogic');

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
    endpoints: ['/api/products', '/api/search', '/api/filters', '/api/generate-sku']
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

// Endpoint robusto para generación de SKU
app.post('/api/generate-sku', async (req, res) => {
  try {
    const { family, dutyLevel, oemCodes, crossReference } = req.body;

    // Validación de entrada
    if (!family) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campo requerido: family' 
      });
    }

    if (!dutyLevel) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campo requerido: dutyLevel (HD o LD)' 
      });
    }

    if (!oemCodes || !Array.isArray(oemCodes) || oemCodes.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campo requerido: oemCodes (array de códigos OEM)' 
      });
    }

    // Generar SKU usando businessLogic
    const sku = businessLogic.generateSKU(family, dutyLevel, oemCodes, crossReference);

    // Información detallada del proceso
    const donaldsonCode = businessLogic.findDonaldsonCode(crossReference);
    const framCode = businessLogic.findFramCode(crossReference);
    const mostCommonOEM = businessLogic.getMostCommonOEM(oemCodes);

    res.json({
      success: true,
      sku: sku,
      details: {
        family: family,
        dutyLevel: dutyLevel,
        prefix: businessLogic.getElimfiltersPrefix(family),
        sourceCode: dutyLevel === 'HD' 
          ? (donaldsonCode || mostCommonOEM)
          : dutyLevel === 'LD'
          ? (framCode || mostCommonOEM)
          : mostCommonOEM,
        donaldsonFound: !!donaldsonCode,
        framFound: !!framCode,
        usedFallback: dutyLevel === 'HD' ? !donaldsonCode : dutyLevel === 'LD' ? !framCode : false
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating SKU:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate SKU', 
      details: error.message 
    });
  }
});

// Endpoint para validar y procesar datos de filtro completos
app.post('/api/process-filter', async (req, res) => {
  try {
    const { family, specs, oemCodes, crossReference, rawData } = req.body;

    // Validación de entrada
    if (!rawData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campo requerido: rawData (datos maestros del filtro)' 
      });
    }

    // Procesar datos del filtro con validación completa
    const processedData = businessLogic.processFilterData(
      family, 
      specs, 
      oemCodes, 
      crossReference, 
      rawData
    );

    // Generar SKU si no existe en rawData
    let generatedSKU = null;
    if (processedData.duty_level && oemCodes) {
      try {
        generatedSKU = businessLogic.generateSKU(
          family || rawData.family,
          processedData.duty_level,
          oemCodes,
          crossReference
        );
      } catch (skuError) {
        console.warn('SKU generation warning:', skuError.message);
      }
    }

    res.json({
      success: true,
      data: processedData,
      generatedSKU: generatedSKU,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing filter:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process filter data', 
      details: error.message 
    });
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
