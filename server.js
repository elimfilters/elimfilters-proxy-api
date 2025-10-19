require('dotenv').config();
const express = require('express');
const cors = require('cors');
const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');
const businessLogic = require('./businessLogic');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let sheetsInstance;

async function initializeServices() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    detectionService.setSheetsInstance(sheetsInstance);
    console.log('Services initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing services:', error);
    throw error;
  }
}

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    sheetsConnected: sheetsInstance ? true : false
  });
});

app.get('/api/products', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'Google Sheets not initialized'
      });
    }

    const query = req.query.q;
    const products = await sheetsInstance.searchProducts(query);

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching products',
      message: error.message
    });
  }
});

app.get('/api/products/:sku', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'Google Sheets not initialized'
      });
    }

    const { sku } = req.params;
    const products = await sheetsInstance.searchProducts(sku);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: products[0]
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching product',
      message: error.message
    });
  }
});

app.post('/api/detect-filter', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'Google Sheets not initialized'
      });
    }

    const { query } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Query required',
        message: 'Must provide a filter code to detect'
      });
    }

    console.log('Detecting filter for query:', query);

    const result = await detectionService.detectFilter(query);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error detecting filter:', error);
    res.status(500).json({
      success: false,
      error: 'Error detecting filter',
      message: error.message
    });
  }
});

app.post('/api/generate-sku', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'Google Sheets not initialized'
      });
    }

    const { filterType, family, specs, oemCodes, crossReference, rawData } = req.body;

    if (!filterType || !family || !rawData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Required: filterType, family, rawData'
      });
    }

    console.log('Generating SKU for filter type:', filterType, 'family:', family);

    const sku = businessLogic.generateSKU(
      filterType,
      family,
      specs || {},
      oemCodes || [],
      crossReference || [],
      rawData
    );

    res.json({
      success: true,
      data: {
        sku: sku,
        filterType: filterType,
        family: family,
        dutyLevel: rawData.duty_level,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating SKU:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating SKU',
      message: error.message
    });
  }
});

app.post('/api/process-filter', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'Google Sheets not initialized'
      });
    }

    const { family, specs, oemCodes, crossReference, rawData } = req.body;

    if (!family || !rawData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Required: family, rawData'
      });
    }

    console.log('Processing filter data for family:', family);

    const processedData = businessLogic.processFilterData(
      family,
      specs || {},
      oemCodes || [],
      crossReference || [],
      rawData
    );

    res.json({
      success: true,
      data: processedData
    });
  } catch (error) {
    console.error('Error processing filter data:', error);
    res.status(500).json({
      success: false,
      error: 'Error processing filter data',
      message: error.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: 'The route ' + req.method + ' ' + req.path + ' does not exist'
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

async function startServer() {
  try {
    await initializeServices();

    app.listen(PORT, () => {
      console.log('Server running on port', PORT);
      console.log('Health check available at: http://localhost:' + PORT + '/health');
      console.log('Detection API: http://localhost:' + PORT + '/api/detect-filter');
    });
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  process.exit(0);
});
