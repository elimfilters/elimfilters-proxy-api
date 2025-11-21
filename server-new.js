// server.js v4.3.1 - CORREGIDO (con endpoint /api/v1/filters/search)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const NodeCache = require('node-cache');

const app = express();
const PORT = process.env.PORT || 8080;

// Cache (5 minutos)
const cache = new NodeCache({ stdTTL: 300 });

// Middlewares
app.use(cors({
  origin: [
    'https://elimfilters.com',
    'https://www.elimfilters.com',
    'http://localhost:8000',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Importar servicios
const GoogleSheetsService = require('./googleSheetsConnector');
const { detectFilter, setSheetsInstance } = require('./detectionService');

// Inicializar Google Sheets
const sheetsService = new GoogleSheetsService();

console.log('🚀 [SERVER] Iniciando servidor v4.3.1...');

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Ruta principal POST
app.post('/api/detect-filter', async (req, res) => {
  try {
    const { q } = req.body;
    
    if (!q) {
      return res.status(400).json({ 
        status: 'ERROR',
        message: 'Query parameter "q" is required'
      });
    }

    console.log(`🔍 [API POST] Query: ${q}`);

    const cacheKey = `filter_${q.toUpperCase()}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log(`✅ [CACHE] Hit`);
      return res.json({ ...cached, from_cache: true });
    }

    const result = await detectFilter(q, sheetsService);
    
    if (result.status === 'OK') {
      cache.set(cacheKey, result);
    }

    console.log(`✅ [API POST] SKU: ${result.sku}`);
    res.json(result);

  } catch (error) {
    console.error('❌ [API POST] Error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// Ruta GET
app.get('/api/detect-filter', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ 
        status: 'ERROR',
        message: 'Query parameter "q" required',
        example: '/api/detect-filter?q=P551551'
      });
    }

    console.log(`🔍 [API GET] Query: ${q}`);

    const cacheKey = `filter_${q.toUpperCase()}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json({ ...cached, from_cache: true });
    }

    const result = await detectFilter(q, sheetsService);
    
    if (result.status === 'OK') {
      cache.set(cacheKey, result);
    }

    console.log(`✅ [API GET] SKU: ${result.sku}`);
    res.json(result);

  } catch (error) {
    console.error('❌ [API GET] Error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// ============================================================================
// NUEVO ENDPOINT: /api/v1/filters/search (para compatibilidad)
// ============================================================================
app.get('/api/v1/filters/search', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ 
        status: 'ERROR',
        message: 'Query parameter "code" required',
        example: '/api/v1/filters/search?code=1R1807'
      });
    }

    console.log(`🔍 [API v1] Query: ${code}`);

    const cacheKey = `filter_${code.toUpperCase()}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log(`✅ [CACHE] Hit`);
      return res.json({ ...cached, from_cache: true });
    }

    const result = await detectFilter(code, sheetsService);
    
    if (result.status === 'OK') {
      cache.set(cacheKey, result);
    }

    console.log(`✅ [API v1] SKU: ${result.sku}`);
    res.json(result);

  } catch (error) {
    console.error('❌ [API v1] Error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// Iniciar servidor
async function startServer() {
  try {
    console.log('🟡 Iniciando Google Sheets...');
    await sheetsService.initialize();
    setSheetsInstance(sheetsService);
    console.log('✅ Google Sheets OK');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Servidor en puerto ${PORT}`);
      console.log(`📡 POST: /api/detect-filter`);
      console.log(`📡 GET:  /api/detect-filter?q=XXX`);
      console.log(`📡 GET:  /api/v1/filters/search?code=XXX`);
      console.log(`📡 Health: /health`);
    });

  } catch (error) {
    console.error('❌ ERROR CRÍTICO:', error.message);
    process.exit(1);
  }
}

startServer();
