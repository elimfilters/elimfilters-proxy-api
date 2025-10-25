/**
 * server.js - v2.3.1 Elimfilters Proxy API (Railway)
 * Flujo: WordPress → Express → n8n → Express → WordPress
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------
// 1. Middleware base
// ---------------------------
app.use(express.json());

// CORS seguro
app.use(cors({
  origin: [
    'https://elimfilters.com',
    'https://www.elimfilters.com'
  ],
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Rate Limit - Previene abuso
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 50, // 50 requests/minuto por IP
  message: { success: false, message: 'Too many requests' }
}));

// ---------------------------
// 2. Health checks
// ---------------------------
app.get(['/health', '/healthz'], (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ELIMFILTERS Proxy API',
    version: '2.3.1',
    time: new Date().toISOString()
  });
});

app.get('/', (_req, res) => res.redirect('/health'));

// ---------------------------
// 3. Endpoint principal de búsqueda
// ---------------------------
app.post('/api/filter-lookup', async (req, res) => {
  try {
    const code = req.body?.code || req.body?.query || '';
    const cleanCode = (code || '').trim();

    if (!cleanCode) {
      return res.status(400).json({
        success: false,
        message: 'Código requerido'
      });
    }

    // Llamada a n8n
    const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.INTERNAL_API_KEY || ''
      },
      body: JSON.stringify({
        code: cleanCode,
        source: 'elimfilters.com',
        ts: Date.now()
      })
    });

    // Si n8n no responde bien
    if (!n8nResponse.ok) {
      console.error('n8n status:', n8nResponse.status);
      return res.status(502).json({
        success: false,
        message: 'Error de comunicación con n8n'
      });
    }

    const data = await n8nResponse.json();

    // Respuesta estándar para WordPress
    return res.json({
      success: data.success === true,
      sku: data.sku || null,
      filter_type: data.filter_type || null,
      description: data.description || null,
      message: data.message || null
    });
  } catch (err) {
    console.error('Error /api/filter-lookup:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor Express'
    });
  }
});

// ---------------------------
// 4. Endpoint de chat opcional
// ---------------------------
app.post('/chat', async (req, res) => {
  const msg = req.body?.message || '';
  if (!msg.trim()) {
    return res.status(400).json({ reply: 'Mensaje requerido' });
  }
  res.json({
    reply: 'Proxy activo - integración n8n pendiente',
    echo: msg
  });
});

// ---------------------------
// 5. 404 y errores generales
// ---------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.path
  });
});

app.use((err, req, res, _next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno'
  });
});

// ---------------------------
// 6. Iniciar servidor
// ---------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ELIMFILTERS Proxy API activo en puerto ${PORT}`);
  console.log(`📊 Health: GET /health`);
  console.log(`🔍 Lookup: POST /api/filter-lookup`);
  console.log(`💬 Chat: POST /chat`);
});

// ---------------------------
// 7. Shutdown ordenado
// ---------------------------
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

module.exports = app;
