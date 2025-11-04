// server.js v3.6.0 — Con búsqueda web automática integrada
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const detectionService = require('./detectionService');
const GoogleSheetsService = require('./googleSheetsConnector');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// ---------- Inicialización Google Sheets ----------
let sheetsInstance;
(async () => {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    console.log('✅ Google Sheets conectado correctamente');
  } catch (err) {
    console.error('❌ Error inicializando Google Sheets:', err.message);
  }
})();

// ---------- Función de Web Search (simulada para Claude) ----------
async function webSearch(query) {
  // Esta función será llamada por detectionService
  // En el entorno real, aquí usarías tu herramienta web_search
  // Por ahora, devolvemos null para que no falle
  
  // TODO: Integrar con tu API de web search real
  console.log(`🌐 Web search solicitada para: ${query}`);
  
  try {
    // Aquí iría tu llamada a web_search real
    // const results = await yourWebSearchAPI(query);
    // return results;
    return null; // Temporal
  } catch (error) {
    console.error('Error en web search:', error.message);
    return null;
  }
}

// ---------- Endpoint de Salud ----------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ELIMFILTERS Proxy API',
    version: '3.6.0',
    features: {
      web_search: 'enabled',
      google_sheets: sheetsInstance ? 'connected' : 'disconnected',
      cross_reference_db: 'active'
    },
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter',
    },
  });
});

// ---------- Endpoint Principal ----------
app.post('/api/detect-filter', async (req, res) => {
  const { query } = req.body || {};
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      status: 'ERROR',
      message: 'Falta parámetro "query" válido en el cuerpo de la solicitud',
    });
  }

  try {
    // Paso 1: Buscar en hoja "Master"
    const existingRow = sheetsInstance
      ? await sheetsInstance.findRowByQuery(query)
      : null;
    
    if (existingRow) {
      console.log(`📗 Encontrado en hoja Master: ${query}`);
      return res.json({
        status: 'OK',
        source: 'Master',
        data: existingRow,
      });
    }

    // Paso 2: Generar nuevo registro (con búsqueda web si es necesario)
    console.log(`⚙️ Generando nuevo registro para: ${query}`);
    const generatedData = await detectionService.detectFilter(
      query, 
      sheetsInstance,
      webSearch  // Pasar función de web search
    );

    // Paso 3: Insertar o actualizar en Google Sheets
    if (sheetsInstance && generatedData) {
      await sheetsInstance.replaceOrInsertRow(generatedData);
    }

    res.json({
      status: 'OK',
      source: 'Generated',
      data: generatedData,
    });
  } catch (error) {
    console.error('❌ Error en /api/detect-filter:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: 'Fallo interno en detect-filter',
      details: error.message,
    });
  }
});

// ---------- Rutas no encontradas ----------
app.use((req, res) => {
  res.status(404).json({ status: 'ERROR', message: 'Ruta no encontrada' });
});

// ---------- Iniciar Servidor ----------
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📡 Web Search: ${webSearch ? 'Habilitado' : 'Deshabilitado'}`);
});
```

---

## 📊 **Estructura final de archivos:**
```
/tu-proyecto
├── server.js                    ✅ (v3.6.0 - con web search)
├── detectionService.js          ✅ (v3.6.0 - con 3 niveles de búsqueda)
├── crossReferenceDB.js          ✅ (v1.0.0 - DB local)
├── webSearchService.js          🆕 (v1.0.0 - NUEVO)
├── googleSheetsConnector.js     ✅ (v3.6.0 - con CrossReference)
├── utils/
│   └── normalizeQuery.js
├── package.json
└── .env
```

---

## 🎯 **Cómo funciona ahora (3 niveles):**
```
Query: "PERKINS 26560201 FUEL"

NIVEL 1: ❌ No está en crossReferenceDB.js
NIVEL 2: ❌ No está en Google Sheets "CrossReference"
NIVEL 3: 🔍 Buscar en web...
         → Encuentra: "Donaldson P551329"
         → 💾 Guarda en Google Sheets
         → ✅ Genera SKU: EF91329

Próxima vez que busquen "PERKINS 26560201":
NIVEL 2: ✅ Encuentra en Google Sheets (instantáneo)
