/**
 * server.js - v2.3.0 ULTRA SIMPLIFICADO
 * Versión mínima funcional para Railway
 */

require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware básico
app.use(express.json());

// CORS simple
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '2.3.0'
  });
});

app.get('/healthz', (req, res) => res.send('ok'));
app.get('/', (req, res) => res.redirect('/health'));

// Endpoint principal (placeholder hasta conectar n8n)
app.post('/api/v1/filters/search', async (req, res) => {
  try {
    const query = req.body?.query || req.body?.body?.query || '';
    
    if (!query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Query required'
      });
    }

    // Por ahora retorna respuesta de éxito
    // Cuando conectes n8n, aquí irá el forward
    return res.json({
      success: true,
      message: 'API funcional - Pendiente conectar n8n',
      query: query,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  const message = req.body?.message || '';
  if (!message) {
    return res.status(400).json({ reply: 'Mensaje requerido' });
  }
  
  return res.json({
    reply: 'API funcional - Pendiente conectar n8n',
    message: message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on port ${PORT}`);
  console.log(`📊 Health: GET /health`);
  console.log(`🔄 Search: POST /api/v1/filters/search`);
  console.log(`💬 Chat: POST /chat`);
  console.log(`⚠️  N8N integration: Pending configuration`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received');
  process.exit(0);
});

module.exports = app;
