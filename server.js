require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { GoogleSheetsService } = require('./googleSheetsConnector');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware de seguridad
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de 100 requests por IP
});
app.use('/api/', limiter);

// Inicializar Google Sheets
let sheetsService;
(async () => {
  try {
    sheetsService = new GoogleSheetsService();
    await sheetsService.initialize();
    console.log('✓ Google Sheets initialized');
  } catch (error) {
    console.error('✗ Error initializing Google Sheets:', error.message);
  }
})();

// ============================================
// UTILIDADES
// ============================================

// Normalizar código de búsqueda
function normalizeCode(code) {
  if (!code) return '';
  return code.toString()
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, ''); // Solo letras y números
}

// Validar que sea un código válido
function isValidCode(code) {
  const normalized = normalizeCode(code);
  // Debe tener al menos 3 caracteres alfanuméricos
  return normalized.length >= 3 && /[A-Z0-9]{3,}/.test(normalized);
}

// ============================================
// ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    name: 'ElimFilters API',
    version: '2.0.0',
    endpoints: ['/health', '/api/search', '/api/products']
  });
});

// Búsqueda de homologación (SOLO POR CÓDIGO)
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;

    // Validación: código es requerido
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'El código es requerido',
        message: 'Por favor ingresa un código de producto (ej: WIX51515, PH3593A, etc.)'
      });
    }

    // Validación: formato de código
    if (!isValidCode(query)) {
      return res.status(400).json({
        success: false,
        error: 'Código inválido',
        message: 'El código debe tener al menos 3 caracteres alfanuméricos'
      });
    }

    const normalizedQuery = normalizeCode(query);

    // Buscar en Google Sheets
    const allProducts = await sheetsService.getAllProducts();
    
    // Buscar coincidencias en TODAS las columnas de códigos
    const matches = allProducts.filter(product => {
      // Buscar en código principal
      if (normalizeCode(product.codigo) === normalizedQuery) return true;
      
      // Buscar en códigos alternativos (si existen)
      if (product.codigosAlternativos) {
        const altCodes = product.codigosAlternativos.split(',');
        return altCodes.some(code => normalizeCode(code) === normalizedQuery);
      }
      
      return false;
    });

    if (matches.length === 0) {
      return res.json({
        success: false,
        message: 'No se encontraron homologaciones para este código',
        query: query,
        normalizedQuery: normalizedQuery
      });
    }

    // Retornar resultados
    res.json({
      success: true,
      query: query,
      normalizedQuery: normalizedQuery,
      totalResults: matches.length,
      results: matches
    });

  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// Obtener todos los productos
app.get('/api/products', async (req, res) => {
  try {
    const products = await sheetsService.getAllProducts();
    res.json({
      success: true,
      total: products.length,
      products: products
    });
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo productos',
      message: error.message
    });
  }
});

// Obtener producto por ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const products = await sheetsService.getAllProducts();
    const product = products.find(p => p.id === id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    res.json({
      success: true,
      product: product
    });
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo producto',
      message: error.message
    });
  }
});

// Endpoint 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    availableEndpoints: ['/health', '/api/search', '/api/products']
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 ElimFilters API running on port ${PORT}`);
});
