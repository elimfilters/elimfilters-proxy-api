# Crear el server.js corregido

server_js_content = """require('dotenv').config();
const express = require('express');
const cors = require('cors');
const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');
const businessLogic = require('./businessLogic');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Variable global para la instancia de Google Sheets
let sheetsInstance;

// ============================================
// INICIALIZACIÓN
// ============================================

async function initializeServices() {
  try {
    // Crear instancia de Google Sheets
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    
    // Pasar la instancia al detectionService
    detectionService.setSheetsInstance(sheetsInstance);
    
    console.log('✅ Todos los servicios inicializados correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando servicios:', error);
    throw error;
  }
}

// ============================================
// RUTAS DE LA API
// ============================================

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    sheetsConnected: sheetsInstance ? true : false
  });
});

// Endpoint para obtener todos los productos
app.get('/api/products', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Servicio no disponible',
        message: 'Google Sheets no está inicializado'
      });
    }

    const query = req.query.q;
    const products = await sheetsInstance.searchProducts(query);
    
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener productos',
      message: error.message
    });
  }
});

// Endpoint para buscar un producto específico
app.get('/api/products/:sku', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Servicio no disponible',
        message: 'Google Sheets no está inicializado'
      });
    }

    const { sku } = req.params;
    const products = await sheetsInstance.searchProducts(sku);
    
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: products[0]
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener producto',
      message: error.message
    });
  }
});

// Endpoint para detectar tipo de filtro
app.post('/api/detect-filter', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Servicio no disponible',
        message: 'Google Sheets no está inicializado'
      });
    }

    const { query } = req.body;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Query requerido',
        message: 'Debe proporcionar un código de filtro para detectar'
      });
    }

    console.log(`🔍 Detectando filtro para query: ${query}`);
    
    const result = await detectionService.detectFilter(query);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error detecting filter:', error);
    res.status(500).json({
      success: false,
      error: 'Error al detectar filtro',
      message: error.message
    });
  }
});

// Endpoint para generar SKU
app.post('/api/generate-sku', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Servicio no disponible',
        message: 'Google Sheets no está inicializado'
      });
    }

    const { filterType, family, specs, oemCodes, crossReference, rawData } = req.body;
    
    // Validación de campos requeridos
    if (!filterType || !family || !rawData) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos faltantes',
        message: 'Se requieren: filterType, family, rawData'
      });
    }

    console.log(`🏷️ Generando SKU para filtro tipo: ${filterType}, familia: ${family}`);
    
    const sku = businessLogic.generateSKU(
      filterType,
      family,
      specs || {},
      oemCodes || [],
      crossReference || [],
      rawData
    );
    
    res.json({
      success: true,
      data: {
        sku: sku,
        filterType: filterType,
        family: family,
        dutyLevel: rawData.duty_level,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating SKU:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar SKU',
      message: error.message
    });
  }
});

// Endpoint para procesar datos de filtro completos
app.post('/api/process-filter', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Servicio no disponible',
        message: 'Google Sheets no está inicializado'
      });
    }

    const { family, specs, oemCodes, crossReference, rawData } = req.body;
    
    // Validación de campos requeridos
    if (!family || !rawData) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos faltantes',
        message: 'Se requieren: family, rawData'
      });
    }

    console.log(`⚙️ Procesando datos de filtro familia: ${family}`);
    
    const processedData = businessLogic.processFilterData(
      family,
      specs || {},
      oemCodes || [],
      crossReference || [],
      rawData
    );
    
    res.json({
      success: true,
      data: processedData
    });
  } catch (error) {
    console.error('Error processing filter data:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar datos de filtro',
      message: error.message
    });
  }
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    message: `La ruta ${req.method} ${req.path} no existe`
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: err.message
  });
});

// ============================================
// INICIO DEL SERVIDOR
// ============================================

async function startServer() {
  try {
    // Inicializar servicios primero
    await initializeServices();
    
    // Luego iniciar el servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📊 Health check disponible en: http://localhost:${PORT}/health`);
      console.log(`🔍 API de detección: http://localhost:${PORT}/api/detect-filter`);
    });
  } catch (error) {
    console.error('❌ Error fatal al iniciar servidor:', error);
    process.exit(1);
  }
}

// Iniciar el servidor
startServer();

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT recibido, cerrando servidor...');
  process.exit(0);
});
"""

with open('server_FIXED.js', 'w', encoding='utf-8') as f:
    f.write(server_js_content)

print("✅ server.js corregido creado")
print("\nCambios principales:")
print("1. ✅ Instancia correcta de GoogleSheetsService")
print("2. ✅ Función initializeServices() para inicializar todo")
print("3. ✅ Pasa la instancia a detectionService")
print("4. ✅ Validación de servicio disponible en cada endpoint")
print("5. ✅ Manejo de errores mejorado")
