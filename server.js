// server.js v4.2.0 - COMPLETO CON TODAS LAS RUTAS
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
    'http://localhost:3000',
    'http://127.0.0.1:8000',
    'http://127.0.0.1:3000'
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

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Ruta principal: Detect Filter
app.post('/api/detect-filter', async (req, res) => {
  try {
    const { q } = req.body;
    
    if (!q) {
      return res.status(400).json({ 
        status: 'ERROR',
        message: 'Query parameter "q" is required',
        example: { q: 'P551551' }
      });
    }

    console.log(`\n🔍 [API] Query recibido: ${q}`);

    // Verificar cache
    const cacheKey = `filter_${q.toUpperCase()}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log(`✅ [API] Respuesta desde cache`);
      return res.json({ ...cached, from_cache: true });
    }

    // Procesar con detectionService
    const result = await detectFilter(q, sheetsService);
    
    // Guardar en cache si fue exitoso
    if (result.status === 'OK') {
      cache.set(cacheKey, result);
    }

    console.log(`✅ [API] Respuesta: SKU=${result.sku}`);
    res.json(result);

  } catch (error) {
    console.error('❌ [API] Error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: error.message,
      query: req.body.q
    });
  }
});

// Ruta GET (opcional, para testing en navegador)
app.get('/api/detect-filter', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ 
        status: 'ERROR',
        message: 'Query parameter "q" is required',
        example: '/api/detect-filter?q=P551551'
      });
    }

    console.log(`\n🔍 [API GET] Query recibido: ${q}`);

    // Verificar cache
    const cacheKey = `filter_${q.toUpperCase()}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log(`✅ [API GET] Respuesta desde cache`);
      return res.json({ ...cached, from_cache: true });
    }

    // Procesar
    const result = await detectFilter(q, sheetsService);
    
    if (result.status === 'OK') {
      cache.set(cacheKey, result);
    }

    console.log(`✅ [API GET] Respuesta: SKU=${result.sku}`);
    res.json(result);

  } catch (error) {
    console.error('❌ [API GET] Error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: error.message,
      query: req.query.q
    });
  }
});

// Iniciar servidor
async function startServer() {
  try {
    // Inicializar Google Sheets
    console.log('🟡 Iniciando configuración de Google Sheets...');
    await sheetsService.initialize();
    setSheetsInstance(sheetsService);
    console.log('✅ Google Sheets inicializado correctamente');

    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Servidor corriendo en puerto ${PORT}`);
      console.log(`✅ CORS habilitado para: https://elimfilters.com, https://www.elimfilters.com`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
      console.log(`🔍 API endpoint POST: http://localhost:${PORT}/api/detect-filter`);
      console.log(`🔍 API endpoint GET: http://localhost:${PORT}/api/detect-filter?q=XXXX`);
    });

  } catch (error) {
    console.error('❌ ERROR CRÍTICO al iniciar servidor:', error.message);
    process.exit(1);
  }
}

startServer();
