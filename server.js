// server.js v5.0 - VERIFIED - Sin suposiciones, solo datos verificables
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const NodeCache = require('node-cache');

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================================================
// MIDDLEWARE
// ============================================================================
app.use(morgan('combined'));
app.use(express.json());
app.use(cors({
  origin: [
    'https://elimfilters.com',
    'https://www.elimfilters.com',
    'http://localhost:8000',
    'http://localhost:3000'
  ],
  credentials: true
}));

// ============================================================================
// CACHE (5 minutos)
// ============================================================================
const cache = new NodeCache({ stdTTL: 300 });

// ============================================================================
// SERVICIOS
// ============================================================================
const googleSheetsConnector = require('./googleSheetsConnector');
const { detectFilter, setSheetsInstance } = require('./detectionService');

// Configurar Google Sheets en detectionService
setSheetsInstance(googleSheetsConnector);

console.log('✅ Servicios cargados correctamente');

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get('/health', (req, res) => {
  res.send('OK');
});

// ============================================================================
// INFO DEL SERVICIO
// ============================================================================
app.get('/', (req, res) => {
  res.json({
    service: 'ELIMFILTERS API',
    version: '5.0',
    status: 'online',
    mode: 'verified_data_only',
    description: 'Sin suposiciones - Solo datos verificables de Google Sheets y web oficial',
    endpoints: {
      v1: {
        get: '/api/v1/filters/search?code=XXX',
        description: 'Endpoint principal recomendado'
      },
      legacy: {
        post: '/api/detect-filter',
        get: '/api/detect-filter?q=XXX',
        description: 'Endpoints legacy para compatibilidad'
      },
      health: '/health'
    },
    data_sources: {
      primary: 'Google Sheets',
      secondary: 'Web scraping (Donaldson, FRAM)',
      fallback: 'UNKNOWN (no assumptions made)'
    }
  });
});

// ============================================================================
// ENDPOINT PRINCIPAL V1
// ============================================================================
app.get('/api/v1/filters/search', async (req, res) => {
  try {
    const code = req.query.code;
    
    if (!code) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Parameter "code" is required'
      });
    }
    
    console.log(`🔍 [v1] Query: ${code}`);
    
    // Verificar cache
    const cacheKey = `v1_${code.toUpperCase()}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log('✅ [CACHE] Hit');
      return res.json({
        ...cached,
        from_cache: true
      });
    }
    
    // Detectar filtro (sin suposiciones)
    const result = await detectFilter(code, googleSheetsConnector);
    
    // Guardar en cache
    cache.set(cacheKey, result);
    
    console.log(`✅ [v1] SKU: ${result.sku}, Status: ${result.status}`);
    
    // Si es UNKNOWN, retornar 404
    if (result.status === 'UNKNOWN') {
      return res.status(404).json(result);
    }
    
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
// ENDPOINT LEGACY POST
// ============================================================================
app.post('/api/detect-filter', async (req, res) => {
  try {
    const { q } = req.body;
    
    if (!q) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Parameter "q" is required in request body'
      });
    }
    
    console.log(`🔍 [legacy POST] Query: ${q}`);
    
    const cacheKey = `legacy_${q.toUpperCase()}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log('✅ [CACHE] Hit');
      return res.json({
        ...cached,
        from_cache: true
      });
    }
    
    const result = await detectFilter(q, googleSheetsConnector);
    cache.set(cacheKey, result);
    
    console.log(`✅ [legacy POST] SKU: ${result.sku}, Status: ${result.status}`);
    
    if (result.status === 'UNKNOWN') {
      return res.status(404).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ [legacy POST] Error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// ============================================================================
// ENDPOINT LEGACY GET
// ============================================================================
app.get('/api/detect-filter', async (req, res) => {
  try {
    const q = req.query.q;
    
    if (!q) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Parameter "q" is required'
      });
    }
    
    console.log(`🔍 [legacy GET] Query: ${q}`);
    
    const cacheKey = `legacy_${q.toUpperCase()}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log('✅ [CACHE] Hit');
      return res.json({
        ...cached,
        from_cache: true
      });
    }
    
    const result = await detectFilter(q, googleSheetsConnector);
    cache.set(cacheKey, result);
    
    console.log(`✅ [legacy GET] SKU: ${result.sku}, Status: ${result.status}`);
    
    if (result.status === 'UNKNOWN') {
      return res.status(404).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ [legacy GET] Error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// ============================================================================
// INICIO DEL SERVIDOR
// ============================================================================
app.listen(PORT, () => {
  console.log('🚀 [SERVER] Iniciando servidor v5.0 VERIFIED...');
  console.log(`✅ Servidor activo en puerto ${PORT}`);
  console.log('📡 Endpoint principal: /api/v1/filters/search?code=XXX');
  console.log('📡 Legacy POST:        /api/detect-filter');
  console.log('📡 Legacy GET:         /api/detect-filter?q=XXX');
  console.log('📡 Health check:       /health');
  console.log('📡 Info:               /');
  console.log('');
  console.log('🔒 Modo: SOLO DATOS VERIFICABLES');
  console.log('   1. Google Sheets (fuente primaria)');
  console.log('   2. Web scraping (fuente secundaria)');
  console.log('   3. UNKNOWN (sin suposiciones)');
  console.log('');
  console.log('🌐 Sistema listo');
});
