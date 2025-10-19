require('dotenv').config();
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
// RUTAS DE LA API
// ============================================

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API'
  });
});

// Endpoint para obtener todos los productos
app.get('/api/products', async (req, res) => {
  try {
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
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro "query" es requerido'
      });
    }

    console.log(`🔍 Detectando filtro para: ${query}`);
    
    // Buscar primero en Master
    const masterResult = await sheetsInstance.searchInMaster(query);
    
    if (masterResult.found) {
      console.log('✅ Encontrado en Master');
      return res.json({
        success: true,
        source: 'master',
        data: masterResult.data
      });
    }

    // Si no está en Master, usar detección
    console.log('🔎 No encontrado en Master, iniciando detección...');
    const detectionResult = await detectionService.detectFilter(query, sheetsInstance);
    
    res.json({
      success: true,
      source: 'detection',
      data: detectionResult
    });

  } catch (error) {
    console.error('❌ Error en detect-filter:', error);
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
    const { filterData } = req.body;
    
    if (!filterData) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro "filterData" es requerido'
      });
    }

    console.log(`🏷️ Generando SKU para:`, filterData);
    
    const skuResult = businessLogic.generateSKU(filterData);
    
    res.json({
      success: true,
      data: skuResult
    });

  } catch (error) {
    console.error('❌ Error en generate-sku:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar SKU',
      message: error.message
    });
  }
});

// Endpoint para procesar filtro completo (detección + SKU)
app.post('/api/process-filter', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro "query" es requerido'
      });
    }

    console.log(`🔄 Procesando filtro completo: ${query}`);
    
    // 1. Buscar en Master
    const masterResult = await sheetsInstance.searchInMaster(query);
    
    if (masterResult.found) {
      console.log('✅ Encontrado en Master');
      return res.json({
        success: true,
        source: 'master',
        data: masterResult.data
      });
    }

    // 2. Detectar filtro
    console.log('🔎 Detectando filtro...');
    const detectionResult = await detectionService.detectFilter(query, sheetsInstance);
    
    // 3. Generar SKU
    console.log('🏷️ Generando SKU...');
    const skuResult = businessLogic.generateSKU(detectionResult);
    
    // 4. Combinar resultados
    const finalData = {
      ...detectionResult,
      ...skuResult
    };

    // 5. Guardar en Master (opcional)
    // await sheetsInstance.saveToMaster(finalData);
    
    res.json({
      success: true,
      source: 'detection',
      data: finalData
    });

  } catch (error) {
    console.error('❌ Error en process-filter:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar filtro',
      message: error.message
    });
  }
});

// Ruta 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

// ============================================
// INICIALIZACIÓN DEL SERVIDOR
// ============================================

async function startServer() {
  try {
    console.log('🚀 Iniciando servidor...');
    
    // Crear instancia de Google Sheets
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    console.log('✅ Google Sheets conectado correctamente');
    
    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Servidor corriendo en puerto ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
