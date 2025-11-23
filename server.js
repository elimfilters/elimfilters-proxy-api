const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const NodeCache = require('node-cache');
const { connectDB } = require('./dbConnector'); // CONEXIÓN MONGO

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

// Configurar Sheets en detectionService
setSheetsInstance(googleSheetsConnector);

console.log('✅ Servicios cargados correctamente');

// ============================================================================
// RUTAS
// ============================================================================
app.get('/health', (req, res) => { res.send('OK'); });
app.get('/', (req, res) => {
  res.json({
    service: 'ELIMFILTERS API',
    version: '5.3 (FINAL FIX)',
    status: 'online',
    data_sources: {
      primary: 'Google Sheets',
      secondary: 'MongoDB Cache',
      tertiary: 'Web scraping (Donaldson, FRAM)',
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
    if (cached) { return res.json({ ...cached, from_cache: true }); }
    
    const result = await detectFilter(code, googleSheetsConnector);
    cache.set(cacheKey, result);
    if (result.status === 'UNKNOWN') { return res.status(404).json(result); }
    res.json(result);
  } catch (error) {
    console.error('❌ [v1] Error:', error.message);
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

// Los endpoints legacy deben llamar a detectFilter
app.post('/api/detect-filter', async (req, res) => { /* Código para POST */ });
app.get('/api/detect-filter', async (req, res) => { /* Código para GET */ });


// ============================================================================
// INICIO DEL SERVIDOR (CON DIAGNÓSTICO INCLUIDO)
// ============================================================================
async function startServer() { 
    console.log('🔍 [DIAG] Iniciando proceso de conexión a la base de datos...');
    try {
        await connectDB(); // <-- AQUÍ ES DONDE SE INTENTA LA CONEXIÓN
        console.log('✅ [DIAG] Conexión a la base de datos exitosa.');
        
        app.listen(PORT, () => {
            console.log('🚀 [SERVER] Iniciando servidor v5.3...'); 
            console.log(`✅ Servidor activo en puerto ${PORT}`);
            console.log('🌐 SISTEMA LISTO Y ESTABLE.');
        });
    } catch (error) {
        console.error('❌ [DIAG] DETALLE COMPLETO DEL ERROR:');
        console.error(error); // <-- ESTA LÍNEA NOS MOSTRARÁ EL ERROR REAL EN RAILWAY
        console.error('❌ [DIAG] FIN DEL ERROR.');
        process.exit(1); 
    }
}

startServer();
