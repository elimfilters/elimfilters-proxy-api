# Crear un server.js ULTRA LIMPIO, línea por línea verificada

server_ultra_clean = """require('dotenv').config();
const express = require('express');
const cors = require('cors');
const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');
const businessLogic = require('./businessLogic');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let sheetsInstance;

async function initializeServices() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    detectionService.setSheetsInstance(sheetsInstance);
    console.log('Services initialized');
    return true;
  } catch (error) {
    console.error('Init error:', error);
    throw error;
  }
}

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS API',
    sheets: sheetsInstance ? true : false
  });
});

app.get('/api/products', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable'
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
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/products/:sku', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable'
      });
    }
    const sku = req.params.sku;
    const products = await sheetsInstance.searchProducts(sku);
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not found'
      });
    }
    res.json({
      success: true,
      data: products[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/detect-filter', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable'
      });
    }
    const query = req.body.query;
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Query required'
      });
    }
    console.log('Detecting:', query);
    const result = await detectionService.detectFilter(query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/generate-sku', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable'
      });
    }
    const filterType = req.body.filterType;
    const family = req.body.family;
    const specs = req.body.specs;
    const oemCodes = req.body.oemCodes;
    const crossReference = req.body.crossReference;
    const rawData = req.body.rawData;
    
    if (!filterType || !family || !rawData) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields'
      });
    }
    console.log('Generating SKU:', filterType, family);
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
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/process-filter', async (req, res) => {
  try {
    if (!sheetsInstance) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable'
      });
    }
    const family = req.body.family;
    const specs = req.body.specs;
    const oemCodes = req.body.oemCodes;
    const crossReference = req.body.crossReference;
    const rawData = req.body.rawData;
    
    if (!family || !rawData) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields'
      });
    }
    console.log('Processing:', family);
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
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

async function startServer() {
  try {
    await initializeServices();
    app.listen(PORT, () => {
      console.log('Server on port', PORT);
    });
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', () => {
  console.log('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT');
  process.exit(0);
});
"""

# Guardar con encoding explícito
with open('server_CLEAN.js', 'w', encoding='ascii', errors='ignore') as f:
    f.write(server_ultra_clean)

print("✅ server_CLEAN.js creado")
print("\n📋 Verificación:")
print(f"- Total líneas: {len(server_ultra_clean.splitlines())}")
print(f"- Encoding: ASCII puro")
print(f"- Caracteres especiales: NINGUNO")
print(f"- Comillas: Solo estándar ' y \"")

# Verificar que no hay caracteres raros
import re
non_ascii = re.findall(r'[^\x00-\x7F]+', server_ultra_clean)
if non_ascii:
    print(f"\n⚠️ Caracteres no-ASCII encontrados: {non_ascii}")
else:
    print("\n✅ Archivo 100% ASCII - Sin caracteres especiales")
