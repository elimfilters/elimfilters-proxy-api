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
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // límite de 100 requests por IP
});
app.use('/api/', limiter);

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Inicializar Google Sheets
let sheetsService = null;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1Aq-Aq-Aq-Aq-Aq-Aq-Aq-Aq-Aq-Aq-Aq';

async function initializeSheets() {
    try {
        sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
        await sheetsService.initialize();
        console.log('✓ Google Sheets initialized successfully');
    } catch (error) {
        console.error('✗ Error initializing Google Sheets:', error.message);
        // No lanzar error, permitir que el servidor arranque
    }
}

// Inicializar al arrancar
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
                error: 'Google Sheets not initialized',
                message: 'Service temporarily unavailable'
            });
        }

        const products = await sheetsService.getAllProducts();
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

// Buscar productos
app.post('/api/search', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        if (!sheetsService) {
            return res.status(503).json({
                success: false,
                error: 'Google Sheets not initialized'
            });
        }

        const allProducts = await sheetsService.getAllProducts();
        
        // Búsqueda simple por nombre, marca o categoría
        const results = allProducts.filter(product => {
            const searchTerm = query.toLowerCase();
            return (
                product.name?.toLowerCase().includes(searchTerm) ||
                product.brand?.toLowerCase().includes(searchTerm) ||
                product.category?.toLowerCase().includes(searchTerm)
            );
        });

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

// Obtener producto por ID
app.get('/api/products/:id', async (req, res) => {
    try {
        if (!sheetsService) {
            return res.status(503).json({
                success: false,
                error: 'Google Sheets not initialized'
            });
        }

        const products = await sheetsService.getAllProducts();
        const product = products.find(p => p.id === req.params.id);

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
app.listen(PORT, () => {
    console.log(`🚀 ElimFilters API running on port ${PORT}`);
});
