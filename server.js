const express = require('express');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const NodeCache = require('node-cache');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CONFIGURACIÓN
// ============================================

// URL del webhook de n8n (configurar en Railway)
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://elimfilters.app.n8n.cloud/webhook/ELIMFILTERS_SEARCH_MASTER';

// Sistema de caché inteligente
const masterCache = new NodeCache({ 
  stdTTL: 86400,      // 24 horas para códigos homologados
  checkperiod: 3600,   // Check cada 1 hora
  useClones: false     // Performance
});

const aiCache = new NodeCache({ 
  stdTTL: 3600,        // 1 hora para códigos generados por IA
  checkperiod: 600,
  useClones: false
});

// Estadísticas
const stats = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  masterHits: 0,
  aiHits: 0,
  errors: 0,
  avgResponseTime: []
};

// ============================================
// MIDDLEWARE
// ============================================

// Seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    '*',
  methods: ['GET', 'POST'],
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Logging
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  message: {
    error: true,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// API Key middleware (opcional pero recomendado)
const apiKeyAuth = (req, res, next) => {
  const apiKey = process.env.API_KEY;
  
  // Si no hay API_KEY configurado, skip
  if (!apiKey) return next();
  
  const providedKey = req.headers['x-api-key'] || req.query.apikey;
  
  if (!providedKey || providedKey !== apiKey) {
    return res.status(401).json({
      error: true,
      message: 'Unauthorized: Invalid or missing API key'
    });
  }
  
  next();
};

// ============================================
// UTILIDADES
// ============================================

// Normalizar query
function normalizeQuery(query) {
  return query
    .toString()
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '');
}

// Generar cache key
function getCacheKey(query) {
  return `filter:${normalizeQuery(query)}`;
}

// Calcular tiempo de respuesta promedio
function updateAvgResponseTime(duration) {
  stats.avgResponseTime.push(duration);
  if (stats.avgResponseTime.length > 100) {
    stats.avgResponseTime.shift(); // Mantener últimas 100
  }
}

function getAvgResponseTime() {
  if (stats.avgResponseTime.length === 0) return 0;
  const sum = stats.avgResponseTime.reduce((a, b) => a + b, 0);
  return Math.round(sum / stats.avgResponseTime.length);
}

// ============================================
// ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cache: {
      master: masterCache.getStats(),
      ai: aiCache.getStats()
    }
  });
});

// Estadísticas
app.get('/api/stats', (req, res) => {
  const masterStats = masterCache.getStats();
  const aiStats = aiCache.getStats();
  
  res.json({
    requests: {
      total: stats.totalRequests,
      errors: stats.errors,
      successRate: stats.totalRequests > 0 
        ? ((stats.totalRequests - stats.errors) / stats.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    },
    cache: {
      hits: stats.cacheHits,
      misses: stats.cacheMisses,
      hitRate: stats.totalRequests > 0 
        ? (stats.cacheHits / stats.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      master: {
        entries: masterStats.keys,
        hits: masterStats.hits,
        misses: masterStats.misses
      },
      ai: {
        entries: aiStats.keys,
        hits: aiStats.hits,
        misses: aiStats.misses
      }
    },
    sources: {
      master: stats.masterHits,
      ai: stats.aiHits,
      masterRate: stats.totalRequests > 0 
        ? (stats.masterHits / stats.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    },
    performance: {
      avgResponseTime: getAvgResponseTime() + 'ms'
    },
    timestamp: new Date().toISOString()
  });
});

// Limpiar caché (útil para debugging)
app.post('/api/cache/clear', apiKeyAuth, (req, res) => {
  const { type } = req.body;
  
  if (type === 'master') {
    masterCache.flushAll();
    res.json({ message: 'Master cache cleared', keys: 0 });
  } else if (type === 'ai') {
    aiCache.flushAll();
    res.json({ message: 'AI cache cleared', keys: 0 });
  } else if (type === 'all') {
    const masterKeys = masterCache.keys().length;
    const aiKeys = aiCache.keys().length;
    masterCache.flushAll();
    aiCache.flushAll();
    res.json({ 
      message: 'All caches cleared', 
      keysCleared: masterKeys + aiKeys 
    });
  } else {
    res.status(400).json({ 
      error: true, 
      message: 'Invalid type. Use: master, ai, or all' 
    });
  }
});

// ============================================
// ENDPOINT PRINCIPAL DE BÚSQUEDA
// ============================================

app.get('/api/search', async (req, res) => {
  const startTime = Date.now();
  stats.totalRequests++;
  
  try {
    const { q } = req.query;
    
    // Validación
    if (!q) {
      return res.status(400).json({
        error: true,
        message: "Parameter 'q' is required",
        example: '/api/search?q=LF9000'
      });
    }
    
    const normalizedQuery = normalizeQuery(q);
    const cacheKey = getCacheKey(normalizedQuery);
    
    // ========================================
    // PASO 1: Verificar caché Master (24h)
    // ========================================
    
    let cachedMaster = masterCache.get(cacheKey);
    if (cachedMaster) {
      stats.cacheHits++;
      stats.masterHits++;
      
      const duration = Date.now() - startTime;
      updateAvgResponseTime(duration);
      
      return res.json({
        ...cachedMaster,
        metadata: {
          ...cachedMaster.metadata,
          cached: true,
          cacheType: 'master',
          responseTime: duration + 'ms',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // ========================================
    // PASO 2: Verificar caché AI (1h)
    // ========================================
    
    let cachedAI = aiCache.get(cacheKey);
    if (cachedAI) {
      stats.cacheHits++;
      stats.aiHits++;
      
      const duration = Date.now() - startTime;
      updateAvgResponseTime(duration);
      
      return res.json({
        ...cachedAI,
        metadata: {
          ...cachedAI.metadata,
          cached: true,
          cacheType: 'ai',
          responseTime: duration + 'ms',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // ========================================
    // PASO 3: Cache MISS - Llamar a n8n
    // ========================================
    
    stats.cacheMisses++;
    
    console.log(`[CACHE MISS] Calling n8n for: ${normalizedQuery}`);
    
    const n8nResponse = await axios.get(N8N_WEBHOOK_URL, {
      params: { q: normalizedQuery },
      timeout: 30000, // 30 segundos
      headers: {
        'User-Agent': 'ELIMFILTERS-Express-Proxy/1.0'
      }
    });
    
    const result = n8nResponse.data;
    const duration = Date.now() - startTime;
    updateAvgResponseTime(duration);
    
    // ========================================
    // PASO 4: Determinar tipo de respuesta
    // ========================================
    
    const isHomologated = result.homologated === true || 
                          result.source === 'master' ||
                          result.metadata?.source === 'master';
    
    // ========================================
    // PASO 5: Cachear según tipo
    // ========================================
    
    if (isHomologated) {
      // Código homologado → Caché 24h
      masterCache.set(cacheKey, result);
      stats.masterHits++;
      
      console.log(`[MASTER] Cached for 24h: ${normalizedQuery}`);
    } else {
      // Código generado por IA → Caché 1h
      aiCache.set(cacheKey, result);
      stats.aiHits++;
      
      console.log(`[AI] Cached for 1h: ${normalizedQuery}`);
    }
    
    // ========================================
    // PASO 6: Retornar con metadata
    // ========================================
    
    return res.json({
      ...result,
      metadata: {
        ...result.metadata,
        cached: false,
        source: isHomologated ? 'master' : 'ai',
        precision: isHomologated ? 'exact' : 'generated',
        responseTime: duration + 'ms',
        cacheExpiry: isHomologated ? '24h' : '1h',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    stats.errors++;
    
    console.error('[ERROR]', error.message);
    
    // Error handling detallado
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: true,
        message: 'Request timeout: n8n workflow took too long',
        code: 'TIMEOUT'
      });
    }
    
    if (error.response) {
      // Error de n8n
      return res.status(error.response.status).json({
        error: true,
        message: 'n8n workflow error',
        details: error.response.data,
        code: 'N8N_ERROR'
      });
    }
    
    // Error genérico
    return res.status(500).json({
      error: true,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// MANEJO DE ERRORES GLOBAL
// ============================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /api/search?q={code}',
      'GET /api/stats',
      'POST /api/cache/clear'
    ]
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR]', err);
  
  res.status(500).json({
    error: true,
    message: 'Unexpected error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================
// INICIO DEL SERVIDOR
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🚀 ELIMFILTERS EXPRESS PROXY ACTIVO      ║
╠════════════════════════════════════════════╣
║  Puerto: ${PORT.toString().padEnd(35)}║
║  n8n: ${(N8N_WEBHOOK_URL.length > 30 ? '...' + N8N_WEBHOOK_URL.slice(-27) : N8N_WEBHOOK_URL).padEnd(35)}║
║  Caché Master: 24h                         ║
║  Caché AI: 1h                              ║
╚════════════════════════════════════════════╝
  `);
  
  console.log('📊 Endpoints disponibles:');
  console.log('  GET  /health');
  console.log('  GET  /api/search?q={code}');
  console.log('  GET  /api/stats');
  console.log('  POST /api/cache/clear');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  masterCache.close();
  aiCache.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  masterCache.close();
  aiCache.close();
  process.exit(0);
});
