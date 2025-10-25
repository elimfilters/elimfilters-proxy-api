/**
 * server.js - v2.4.0 COMPLETO CON VALIDACIÓN
 * 
 * CARACTERÍSTICAS:
 * ✅ Validación completa de input
 * ✅ Manejo de errores robusto (igual a n8n)
 * ✅ Respuestas estandarizadas
 * ✅ Códigos de error claros
 * ✅ Integración lista para n8n
 */

require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ============================================================================
// VALIDACIÓN DE INPUT
// ============================================================================

/**
 * Valida el código de filtro
 * @param {string} code - Código a validar
 * @returns {object} - {valid: boolean, error?: string, error_code?: string, normalized?: string}
 */
function validateFilterCode(code) {
  // Check if code exists
  if (!code || typeof code !== 'string' || code.trim() === '') {
    return {
      valid: false,
      error: 'Code is required',
      error_code: 'MISSING_CODE'
    };
  }

  const normalized = code.trim().toUpperCase();

  // Length validation (3-10 characters)
  if (normalized.length < 3 || normalized.length > 10) {
    return {
      valid: false,
      error: 'Code must be 3-10 characters',
      error_code: 'INVALID_LENGTH',
      received: code
    };
  }

  // Character validation (alphanumeric + -_.)
  if (!/^[A-Z0-9\-_.]+$/.test(normalized)) {
    return {
      valid: false,
      error: 'Invalid characters in code. Only alphanumeric and -_. allowed',
      error_code: 'INVALID_CHARS',
      received: code
    };
  }

  // Valid
  return {
    valid: true,
    normalized: normalized,
    original: code
  };
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '2.4.0',
    endpoints: {
      health: 'GET /health',
      search: 'POST /api/v1/filters/search',
      lookup: 'POST /api/v1/filters/lookup',
      chat: 'POST /chat'
    }
  });
});

app.get('/healthz', (req, res) => res.send('ok'));
app.get('/', (req, res) => res.redirect('/health'));

// ============================================================================
// FILTER SEARCH ENDPOINT
// ============================================================================

app.post('/api/v1/filters/search', async (req, res) => {
  try {
    const code = req.body?.code || req.body?.query || req.body?.body?.code || req.body?.body?.query || '';
    
    // VALIDACIÓN
    const validation = validateFilterCode(code);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        error_code: validation.error_code,
        received: validation.received,
        timestamp: new Date().toISOString()
      });
    }

    // TODO: Aquí conectar con n8n webhook cuando esté listo
    // Por ahora, respuesta de placeholder
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    
    if (N8N_WEBHOOK_URL) {
      // Forward a n8n
      const fetch = require('node-fetch');
      const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validation.normalized,
          source: 'railway-api'
        })
      });

      const n8nData = await n8nResponse.json();
      return res.status(n8nResponse.status).json(n8nData);
    }

    // Placeholder response (cuando n8n no está configurado)
    return res.json({
      success: true,
      message: 'Code validated successfully - n8n integration pending',
      code: validation.normalized,
      original_code: validation.original,
      timestamp: new Date().toISOString(),
      note: 'Set N8N_WEBHOOK_URL environment variable to enable full integration'
    });

  } catch (error) {
    console.error('❌ Error in /api/v1/filters/search:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      error_code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// FILTER LOOKUP ENDPOINT (Alternativo)
// ============================================================================

app.post('/api/v1/filters/lookup', async (req, res) => {
  try {
    const code = req.body?.code || '';
    
    // VALIDACIÓN
    const validation = validateFilterCode(code);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        error_code: validation.error_code,
        received: validation.received,
        timestamp: new Date().toISOString()
      });
    }

    // TODO: Implementar lógica de búsqueda
    // Por ahora, simula respuesta NOT_FOUND
    return res.status(404).json({
      success: false,
      error: 'Filter not found in any source',
      error_code: 'NOT_FOUND',
      searched_code: validation.normalized,
      suggestion: 'Please verify the code and try again',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in /api/v1/filters/lookup:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      error_code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// CHAT ENDPOINT
// ============================================================================

app.post('/chat', async (req, res) => {
  try {
    const message = req.body?.message || '';
    
    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
        error_code: 'MISSING_MESSAGE',
        timestamp: new Date().toISOString()
      });
    }

    // Placeholder
    return res.json({
      success: true,
      reply: 'Chat endpoint functional - Integration pending',
      received_message: message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in /chat:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      error_code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// VALIDATION TEST ENDPOINT (Para testing)
// ============================================================================

app.post('/api/v1/test/validate', (req, res) => {
  const code = req.body?.code || '';
  const validation = validateFilterCode(code);
  
  if (validation.valid) {
    return res.json({
      success: true,
      message: 'Code is valid',
      normalized: validation.normalized,
      original: validation.original,
      timestamp: new Date().toISOString()
    });
  } else {
    return res.status(400).json({
      success: false,
      error: validation.error,
      error_code: validation.error_code,
      received: validation.received,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// ERROR HANDLERS
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    error_code: 'ROUTE_NOT_FOUND',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_routes: {
      health: 'GET /health',
      search: 'POST /api/v1/filters/search',
      lookup: 'POST /api/v1/filters/lookup',
      chat: 'POST /chat',
      validate: 'POST /api/v1/test/validate'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    error_code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// SERVER START
// ============================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('════════════════════════════════════════════════════════');
  console.log('✅ ELIMFILTERS Proxy API - v2.4.0');
  console.log('════════════════════════════════════════════════════════');
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`📊 Health: GET /health`);
  console.log(`🔍 Search: POST /api/v1/filters/search`);
  console.log(`🔎 Lookup: POST /api/v1/filters/lookup`);
  console.log(`💬 Chat: POST /chat`);
  console.log(`🧪 Test: POST /api/v1/test/validate`);
  console.log('');
  console.log('📡 N8N Integration:');
  if (process.env.N8N_WEBHOOK_URL) {
    console.log(`   ✅ Configured: ${process.env.N8N_WEBHOOK_URL}`);
  } else {
    console.log(`   ⚠️  Not configured - Set N8N_WEBHOOK_URL env variable`);
  }
  console.log('════════════════════════════════════════════════════════');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received - Shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT received - Shutting down gracefully');
  process.exit(0);
});

module.exports = app;
