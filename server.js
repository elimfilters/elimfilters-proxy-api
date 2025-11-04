// server.js v3.5.0 — Versión completa con cross-reference
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

// ---------- Endpoint de Salud ----------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ELIMFILTERS Proxy API',
    version: '3.5.0',
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

    // Paso 2: Generar nuevo registro
    console.log(`⚙️ Generando nuevo registro para: ${query}`);
    const generatedData = await detectionService.detectFilter(query);

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
});
```

---

## ✅ **Cambios realizados:**

1. **Línea 3**: Versión actualizada a `3.5.0`
2. **Líneas 39, 48**: Corregidos los `console.log` con template literals correctos
3. **Línea 93**: Corregido el `console.log` final

---

## 📂 **Estructura final de archivos:**
```
/tu-proyecto
├── server.js                  ✅ (Este archivo completo)
├── detectionService.js        ✅ (El que te di antes)
├── crossReferenceDB.js        ✅ (El que te di antes - NUEVO)
├── googleSheetsConnector.js   ✅ (El que corregimos)
├── utils/
│   └── normalizeQuery.js      (Tu archivo existente)
├── package.json
└── .env
