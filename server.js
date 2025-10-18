require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const GoogleSheetsService = require('./googleSheetsConnector');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware de seguridad
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Inicializar Google Sheets
let sheetsService = null;

async function initializeSheets() {
    try {
        sheetsService = new GoogleSheetsService();
        await sheetsService.initialize();
        console.log('✓ Google Sheets initialized successfully');
    } catch (error) {
        console.error('✗ Error initializing Google Sheets:', error.message);
    }
}

initializeSheets();

// ============ ENDPOINTS ============

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        sheetsConnected: sheetsService !== null
    });
});

// Obtener todos los productos
app.get('/api/products', async (req, res) => {
    try {
        if (!sheetsService) {
            return res.status(503).json({
                success: false,
                error: 'Google Sheets not initialized'
            });
        }

        const products = await sheetsService.getProducts();
        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo productos',
            message: error.message
        });
    }
});

// Buscar productos por query
app.get('/api/products/search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter is required'
            });
        }

        if (!sheetsService) {
            return res.status(503).json({
                success: false,
                error: 'Google Sheets not initialized'
            });
        }

        const results = await sheetsService.searchProducts(query);

        res.json({
            success: true,
            query: query,
            count: results.length,
            data: results
        });
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({
            success: false,
            error: 'Error buscando productos',
            message: error.message
        });
    }
});

// Buscar por código OEM
app.get('/api/products/oem/:code', async (req, res) => {
    try {
        if (!sheetsService) {
            return res.status(503).json({
                success: false,
                error: 'Google Sheets not initialized'
            });
        }

        const product = await sheetsService.getProductByOEM(req.params.code);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo producto',
            message: error.message
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ElimFilters API running on port ${PORT}`);
});
