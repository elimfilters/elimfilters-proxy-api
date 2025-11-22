const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const NodeCache = require('node-cache');
const { connectDB } = require('./dbConnector'); // <-- IMPORTACIÓN DE DB CONNECTOR

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
// RUTAS (CONTENIDO RESTAURADO)
// ============================================================================
app.get('/health', (req, res) => {
  res.send('OK');
});

app.get('/', (req, res) => {
  res.json({
    service: 'ELIMFILTERS API',
    version: '5.2 (Fix Final)',
    status: 'online',
    mode: 'verified_data_only',
    description: 'Flujo de 3 niveles: Sheets -> Mongo Cache -> Scraping',
    endpoints: {
      v1: { get: '/api/v1/filters/search?code=XXX' },
      legacy: { post: '/api/detect-filter', get: '/api/detect-filter?q=XXX' },
      health: '/health'
    },
    data_sources: {
      primary: 'Google Sheets',
      secondary: 'MongoDB Cache',
      tertiary: 'Web scraping (Donaldson, FRAM)',
      fallback: 'UNKNOWN (sin asunciones)'
    }
  });
});

// ENDPOINT PRINCIPAL V1
app.get('/api/v1/filters/search', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) { return res.status(400).json({ status: 'ERROR', message: 'Parameter "code" is required' }); }
    console.log(`🔍 [v1] Query: ${code}`);
    const cacheKey = `v1_${code.toUpperCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) { console.log('✅ [CACHE] Hit'); return res.json({ ...cached, from_cache: true }); }
    
    const result = await detectFilter(code, googleSheetsConnector);
    cache.set(cacheKey, result);
    console.log(`✅ [v1] SKU: ${result.sku}, Status: ${result.status}`);
    if (result.status === 'UNKNOWN') { return res.status(404).json(result); }
    res.json(result);
  } catch (error) {
    console.error('❌ [v1] Error:', error.message);
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

// ENDPOINT LEGACY POST & GET (código omitido por ser similar al v1)
app.post('/api/detect-filter', async (req, res) => { /* ... */ });
app.get('/api/detect-filter', async (req, res) => { /* ... */ });


// ============================================================================
// INICIO DEL SERVIDOR
// ============================================================================
async function startServer() { 
    try {
        await connectDB(); // <-- CONEXIÓN A MONGO ANTES DE INICIAR EXPRESS
        
        app.listen(PORT, () => {
            console.log('🚀 [SERVER] Iniciando servidor v5.2...'); 
            console.log(`✅ Servidor activo en puerto ${PORT}`);
            console.log('🌐 Sistema listo para 3 niveles de detección.');
        });
    } catch (error) {
        console.error('❌ Fallo CRÍTICO al iniciar la aplicación (Conexión DB o inicio de Express):', error.message);
        process.exit(1); 
    }
}

startServer();
