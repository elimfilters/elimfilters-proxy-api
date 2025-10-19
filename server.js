// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const googleSheetsConnector = require('./googleSheetsConnector');
const businessLogic = require('./businessLogic');
const detectionService = require('./detectionService');

const app = express();
const PORT = process.env.PORT || 8000;

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// ============================================================================
// ENDPOINTS
// ============================================================================

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'ELIMFILTERS API v1.0',
        endpoints: [
            '/api/products',
            '/api/search',
            '/api/filters',
            '/api/generate-sku',
            '/api/detect-filter'
        ]
    });
});

app.post('/api/detect-filter', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter is required'
            });
        }
        
        console.log(`🔍 Detectando filtro: ${query}`);
        const result = await detectionService.detectFilter(query);
        
        res.json({
            success: true,
            query: query,
            ...result
        });
        
    } catch (error) {
        console.error('❌ Error detecting filter:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/generate-sku', async (req, res) => {
    try {
        const { family, dutyLevel, oemCodes, crossReference } = req.body;
        
        if (!family || !dutyLevel) {
            return res.status(400).json({
                success: false,
                error: 'family and dutyLevel are required'
            });
        }
        
        if (!oemCodes && !crossReference) {
            return res.status(400).json({
                success: false,
                error: 'At least oemCodes or crossReference must be provided'
            });
        }
        
        console.log(`🔧 Generando SKU para: ${family} ${dutyLevel}`);
        
        const sku = businessLogic.generateSKU(
            family,
            dutyLevel,
            oemCodes || [],
            crossReference || []
        );
        
        const prefix = businessLogic.getElimfiltersPrefix(family, dutyLevel);
        const baseCode = businessLogic.applyBaseCodeLogic(
            dutyLevel,
            family,
            oemCodes || [],
            crossReference || []
        );
        
        res.json({
            success: true,
            sku: sku,
            details: {
                family: family,
                dutyLevel: dutyLevel,
                prefix: prefix,
                digits: baseCode,
                sourceCode: determineSourceCode(dutyLevel, oemCodes, crossReference)
            }
        });
        
    } catch (error) {
        console.error('❌ Error generating SKU:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

function determineSourceCode(dutyLevel, oemCodes, crossReference) {
    if (dutyLevel === 'HD') {
        const donaldson = businessLogic.findDonaldsonCode(crossReference);
        if (donaldson) return { type: 'Donaldson', code: donaldson };
    } else if (dutyLevel === 'LD') {
        const fram = businessLogic.findFramCode(crossReference);
        if (fram) return { type: 'Fram', code: fram };
    }
    
    const oem = businessLogic.getMostCommonOEM(oemCodes);
    return { type: 'OEM', code: oem };
}

app.get('/api/products', async (req, res) => {
    try {
        const data = await googleSheetsConnector.readData();
        res.json({
            success: true,
            count: data.length,
            data: data
        });
    } catch (error) {
        console.error('❌ Error fetching products:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter "q" is required'
            });
        }
        
        const allData = await googleSheetsConnector.readData();
        const results = allData.filter(item => 
            JSON.stringify(item).toLowerCase().includes(q.toLowerCase())
        );
        
        res.json({
            success: true,
            query: q,
            count: results.length,
            data: results
        });
        
    } catch (error) {
        console.error('❌ Error searching:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/filters', async (req, res) => {
    try {
        const { family, dutyLevel } = req.query;
        
        const allData = await googleSheetsConnector.readData();
        let results = allData;
        
        if (family) {
            results = results.filter(item => 
                item.family && item.family.toUpperCase() === family.toUpperCase()
            );
        }
        
        if (dutyLevel) {
            results = results.filter(item => 
                item.duty_level && item.duty_level.toUpperCase() === dutyLevel.toUpperCase()
            );
        }
        
        res.json({
            success: true,
            filters: { family, dutyLevel },
            count: results.length,
            data: results
        });
        
    } catch (error) {
        console.error('❌ Error filtering:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// INICIALIZACIÓN (SIN initialize)
// ============================================================================

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`✅ ELIMFILTERS API v1.0 - Ready`);
});
