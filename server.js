require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');

// Import custom modules
const googleSheetsConnector = require('./googleSheetsConnector');
const openAIService = require('./openAIService');
const cacheManager = require('./cacheManager');
const dataAccess = require('./dataAccess');
const searchEngine = require('./searchEngine');
const securityMiddleware = require('./securityMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Initialize services
let isInitialized = false;

async function initializeServices() {
  try {
    console.log('Initializing services...');
    
    // Initialize Google Sheets connection
    await googleSheetsConnector.initialize();
    console.log('✓ Google Sheets connected');
    
    // Initialize cache
    await cacheManager.initialize();
    console.log('✓ Cache manager initialized');
    
    // Load initial data from Google Sheets
    const sheetData = await googleSheetsConnector.getAllData();
    if (sheetData && sheetData.length > 0) {
      console.log(`✓ Loaded ${sheetData.length} records from Google Sheets`);
    }
    
    isInitialized = true;
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Error initializing services:', error);
    // Continue running even if initialization fails
    isInitialized = false;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      initialized: isInitialized,
      googleSheets: googleSheetsConnector.isConnected(),
      cache: cacheManager.isActive()
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'ElimFilters API',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      search: '/api/search',
      homologation: '/api/homologation',
      products: '/api/products',
      sync: '/api/sync'
    }
  });
});

// Search endpoint - Main search functionality
app.post('/api/search',
  securityMiddleware.validateApiKey,
  [
    body('query').notEmpty().trim().withMessage('Query is required'),
    body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { query, limit = 10, useAI = true } = req.body;
      
      console.log(`Search request: "${query}"`);

      // Check cache first
      const cacheKey = `search:${query}:${limit}`;
      const cachedResult = await cacheManager.get(cacheKey);
      if (cachedResult) {
        console.log('Returning cached result');
        return res.json({
          success: true,
          source: 'cache',
          query,
          results: cachedResult
        });
      }

      // Perform search
      let results;
      if (useAI) {
        // Use AI-enhanced search
        const normalizedQuery = await openAIService.normalizeQuery(query);
        results = await searchEngine.search(normalizedQuery, limit);
      } else {
        // Use basic search
        results = await searchEngine.search(query, limit);
      }

      // Cache the results
      await cacheManager.set(cacheKey, results, 3600); // Cache for 1 hour

      res.json({
        success: true,
        source: 'database',
        query,
        results
      });

    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error.message
      });
    }
  }
);

// Homologation endpoint - Find equivalent products
app.post('/api/homologation',
  securityMiddleware.validateApiKey,
  [
    body('brand').notEmpty().trim().withMessage('Brand is required'),
    body('partNumber').notEmpty().trim().withMessage('Part number is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { brand, partNumber } = req.body;
      
      console.log(`Homologation request: ${brand} - ${partNumber}`);

      // Check cache
      const cacheKey = `homolog:${brand}:${partNumber}`;
      const cachedResult = await cacheManager.get(cacheKey);
      if (cachedResult) {
        return res.json({
          success: true,
          source: 'cache',
          equivalents: cachedResult
        });
      }

      // Find homologation
      const equivalents = await dataAccess.findHomologation(brand, partNumber);

      // Cache the results
      await cacheManager.set(cacheKey, equivalents, 7200); // Cache for 2 hours

      res.json({
        success: true,
        source: 'database',
        brand,
        partNumber,
        equivalents
      });

    } catch (error) {
      console.error('Homologation error:', error);
      res.status(500).json({
        success: false,
        error: 'Homologation search failed',
        message: error.message
      });
    }
  }
);

// Get all products endpoint
app.get('/api/products',
  securityMiddleware.validateApiKey,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      // Get data from Google Sheets
      const allData = await googleSheetsConnector.getAllData();
      const total = allData.length;
      const products = allData.slice(skip, skip + limit);

      res.json({
        success: true,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        products
      });

    } catch (error) {
      console.error('Products error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve products',
        message: error.message
      });
    }
  }
);

// Sync endpoint - Force refresh from Google Sheets
app.post('/api/sync',
  securityMiddleware.validateApiKey,
  securityMiddleware.requireAdmin,
  async (req, res) => {
    try {
      console.log('Manual sync requested');

      // Clear cache
      await cacheManager.clear();
      
      // Reload data from Google Sheets
      const sheetData = await googleSheetsConnector.getAllData();
      
      res.json({
        success: true,
        message: 'Data synchronized successfully',
        recordCount: sheetData.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({
        success: false,
        error: 'Sync failed',
        message: error.message
      });
    }
  }
);

// AI Query normalization endpoint (for testing)
app.post('/api/normalize',
  securityMiddleware.validateApiKey,
  [
    body('query').notEmpty().trim().withMessage('Query is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { query } = req.body;
      const normalized = await openAIService.normalizeQuery(query);

      res.json({
        success: true,
        original: query,
        normalized
      });

    } catch (error) {
      console.error('Normalization error:', error);
      res.status(500).json({
        success: false,
        error: 'Normalization failed',
        message: error.message
      });
    }
  }
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Start server
async function startServer() {
  try {
    // Initialize services before starting server
    await initializeServices();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔════════════════════════════════════════╗
║     ElimFilters API Server Running     ║
╠════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(32)} ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(23)} ║
║  Status: Ready                         ║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await cacheManager.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await cacheManager.close();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
