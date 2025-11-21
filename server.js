// ============================================================================
// ELIMFILTERS — API SERVER v4.5 FINAL
// Sistema funcional con endpoints legacy y nuevos
// ============================================================================

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

console.log('🚀 [SERVER] Iniciando servidor v4.5 FINAL...');

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.json({
    service: 'ELIMFILTERS API',
    version: '4.5',
    status: 'online',
    endpoints: {
      legacy: {
        post: '/api/detect-filter',
        get: '/api/detect-filter?q=XXX'
      },
      v1: {
        get: '/api/v1/filters/search?code=XXX'
      },
      health: '/health'
    }
  });
});

// ============================================================================
// ENDPOINT LEGACY: POST /api/detect-filter
// ============================================================================
app.post('/api/detect-filter', async (req, res) => {
  try {
    const { q } = req.body;
    
    if (!q) {
      return res.status(400).json({ 
        status: 'ERROR',
        message: 'Query parameter "q" is required'
      });
    }

    console.log(`🔍 [POST] Query: ${q}`);

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

    console.log(`✅ [POST] SKU: ${result.sku || 'N/A'}`);
    res.json(result);

  } catch (error) {
    console.error('❌ [POST] Error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// ============================================================================
// ENDPOINT LEGACY: GET /api/detect-filter?q=XXX
// ============================================================================
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

    console.log(`🔍 [GET] Query: ${q}`);

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

    console.log(`✅ [GET] SKU: ${result.sku || 'N/A'}`);
    res.json(result);

  } catch (error) {
    console.error('❌ [GET] Error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// ============================================================================
// ENDPOINT V1: GET /api/v1/filters/search?code=XXX
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

    console.log(`🔍 [v1] Query: ${code}`);

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

    console.log(`✅ [v1] SKU: ${result.sku || 'N/A'}`);
    res.json(result);

  } catch (error) {
    console.error('❌ [v1] Error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================
async function startServer() {
  try {
    console.log('🟡 Iniciando Google Sheets...');
    await sheetsService.initialize();
    setSheetsInstance(sheetsService);
    console.log('✅ Google Sheets conectado');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Servidor activo en puerto ${PORT}`);
      console.log(`📡 Legacy POST: /api/detect-filter`);
      console.log(`📡 Legacy GET:  /api/detect-filter?q=XXX`);
      console.log(`📡 V1 GET:      /api/v1/filters/search?code=XXX`);
      console.log(`📡 Health:      /health`);
      console.log(``);
      console.log(`🌐 Sistema listo para recibir peticiones`);
    });

  } catch (error) {
    console.error('❌ ERROR CRÍTICO al iniciar:', error.message);
    process.exit(1);
  }
}

startServer();
