// server.js v3.8.3 — CORS mejorado + formato compatible con WordPress plugin
require('dotenv').config();
const express = require('express');
let helmet;
try {
  helmet = require('helmet');
} catch (e) {
  console.warn('⚠️  Helmet no está instalado; continuando sin middleware de seguridad.');
}
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');
const normalizeQuery = require('./utils/normalizeQuery');
const businessLogic = require('./businessLogic');

const app = express();
const PORT = process.env.PORT || 8080;

// Utilidad para validar URL absoluta
function isValidAbsoluteUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Seguridad HTTP (helmet) opcional
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: true }
  }));
}

// ✅ CORS MEJORADO - Permite orígenes de elimfilters + testing local
const allowedOrigins = [
  'https://elimfilters.com',
  'https://www.elimfilters.com',
  'http://localhost:8000',
  'http://localhost:3000',
  'http://127.0.0.1:8000',
  'http://127.0.0.1:3000'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Permitir orígenes específicos
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Permitir requests sin origin (ej: Postman, cURL, testing)
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // Cache preflight por 24h
  
  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Límite básico de rate limit
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(limiter);

// Instancia de Google Sheets
let sheetsInstance;

async function initializeServices() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    detectionService.setSheetsInstance(sheetsInstance);
    console.log('✅ Servicios inicializados correctamente');
  } catch (error) {
    console.error('❌ Error inicializando servicios:', error);
  }
}

// Endpoint de salud para Railway
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ELIMFILTERS Proxy API',
    version: '3.8.3',
    features: {
      google_sheets: sheetsInstance ? 'connected' : 'disconnected',
      cross_reference_db: 'active',
      wordpress_ready: true,
      cors_enabled: true
    },
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter',
      search: 'GET /api/v1/filters/search'
    }
  });
});

// Endpoint principal de búsqueda
app.get('/api/v1/filters/search', async (req, res) => {
  const part = req.query.part?.trim();
  console.log('🔍 Consulta recibida:', part);

  if (!part) {
    return res.status(400).json({ error: 'Parámetro "part" requerido' });
  }

  try {
    const queryNorm = normalizeQuery(part);
    const masterResult = await sheetsInstance.findRowByQuery(queryNorm);
    console.log('📘 Resultado en Sheet Master:', masterResult);

    if (masterResult && masterResult.found) {
      console.log('✅ Encontrado en Master → devolviendo resultado');
      return res.json({ found: true, data: masterResult });
    }

    console.log('⚙️ No existe en Master → evaluando flujo n8n');
    const webhook = process.env.N8N_WEBHOOK_URL;
    if (webhook && isValidAbsoluteUrl(webhook)) {
      const n8nResponse = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part })
      });

      const n8nData = await n8nResponse.json();
      console.log('📦 Respuesta n8n:', n8nData);

      if (n8nData?.reply) {
        console.log('🆕 Nuevo SKU generado, registrando en Master...');
        await sheetsInstance.replaceOrInsertRow(n8nData.reply);
        console.log('✅ Registro completado, devolviendo al cliente');
        return res.json({ found: false, data: n8nData.reply });
      }

      console.warn('❌ Flujo n8n no devolvió un "reply" válido → usando detección local');
      const fallback = await detectionService.detectFilter(part, sheetsInstance);
      return res.json({ found: false, data: fallback });
    } else {
      console.warn('⚠️ n8n deshabilitado o URL inválida → usando detección local');
      const fallback = await detectionService.detectFilter(part, sheetsInstance);
      return res.json({ found: false, data: fallback });
    }
  } catch (error) {
    console.error('💥 Error en /filters/search:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ MEJORADO: Alias legacy para WordPress plugin
// Mantiene compatibilidad con formato antiguo { status, data, source }
// pero agrega logging para debugging
app.all('/api/detect-filter', async (req, res) => {
  const started = Date.now();
  const q =
    (req.method === 'POST' ? (req.body?.query || req.body?.part || req.body?.code || req.body?.q) : null)
    || req.query.part || req.query.code || req.query.q;

  console.log('🔍 [/api/detect-filter] Consulta recibida:', {
    method: req.method,
    query: q,
    origin: req.headers.origin,
    contentType: req.headers['content-type']
  });

  if (!q) {
    console.warn('⚠️ [/api/detect-filter] Parámetro faltante');
    return res.status(400).json({ 
      status: 'ERROR', 
      message: 'Parámetro "query", "part", "code" o "q" es requerido' 
    });
  }

  try {
    const queryNorm = normalizeQuery(q);
    const masterResult = await sheetsInstance.findRowByQuery(queryNorm);
    
    if (masterResult && masterResult.found) {
      console.log('✅ [/api/detect-filter] Encontrado en cache');
      const payload = {
        status: 'OK',
        data: { ...masterResult, original_query: q },
        source: 'cache',
        response_time_ms: Date.now() - started
      };
      return res.json(payload);
    }

    const webhook = process.env.N8N_WEBHOOK_URL;
    if (webhook && isValidAbsoluteUrl(webhook)) {
      try {
        console.log('⚙️ [/api/detect-filter] Consultando n8n...');
        const n8nResponse = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ part: q })
        });
        const n8nData = await n8nResponse.json();
        
        if (n8nData?.reply) {
          console.log('🆕 [/api/detect-filter] SKU generado por n8n');
          await sheetsInstance.replaceOrInsertRow(n8nData.reply);
          const payload = {
            status: 'OK',
            data: { ...n8nData.reply, original_query: q },
            source: 'generated',
            response_time_ms: Date.now() - started
          };
          return res.json(payload);
        }
        console.warn('❌ [/api/detect-filter] n8n sin reply válido');
      } catch (e) {
        console.warn('❌ [/api/detect-filter] Error invocando n8n:', e.message);
      }
    }

    console.log('🔄 [/api/detect-filter] Usando detección local');
    const fallback = await detectionService.detectFilter(q, sheetsInstance);
    const payload = {
      status: 'OK',
      data: { ...fallback, original_query: q },
      source: 'generated',
      response_time_ms: Date.now() - started
    };
    return res.json(payload);
    
  } catch (error) {
    console.error('💥 [/api/detect-filter] Error:', error);
    return res.status(500).json({ 
      status: 'ERROR', 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Inicializar y arrancar
initializeServices().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT} en 0.0.0.0`);
    console.log(`✅ CORS habilitado para: ${allowedOrigins.join(', ')}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`🔍 API endpoint: http://localhost:${PORT}/api/detect-filter`);
  });
});
