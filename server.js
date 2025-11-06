require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');
const businessLogic = require('./businessLogic');

const app = express();
const PORT = process.env.PORT || 3000;

// Seguridad y performance
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Limite básico
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60
});
app.use(limiter);

// Instancia de Google Sheets
let sheetsInstance;

async function initializeServices() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    detectionService.setSheetsInstance(sheetsInstance);
    console.log('✅ Servicios inicializados correctamente');
  } catch (error) {
    console.error('❌ Error inicializando servicios:', error);
  }
}

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', service: 'elimfilters-proxy-api' });
});

// Endpoint principal de búsqueda
app.get('/api/v1/filters/search', async (req, res) => {
  const part = req.query.part?.trim();
  console.log('🔍 Consulta recibida:', part);

  if (!part) {
    return res.status(400).json({ error: 'Parámetro "part" requerido' });
  }

  try {
    const masterResult = await sheetsInstance.getPart(part);
    console.log('📘 Resultado en Sheet Master:', masterResult);

    if (masterResult && Object.keys(masterResult).length > 0) {
      console.log('✅ Encontrado en Master → devolviendo resultado');
      return res.json({ found: true, data: masterResult });
    }

    console.log('⚙️ No existe en Master → ejecutando flujo n8n');
    const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ part })
    });

    const n8nData = await n8nResponse.json();
    console.log('📦 Respuesta n8n:', n8nData);

    if (n8nData?.reply) {
      console.log('🆕 Nuevo SKU generado, registrando en Master...');
      await sheetsInstance.writeNewPart(n8nData.reply);
      console.log('✅ Registro completado, devolviendo al cliente');
      return res.json({ found: false, data: n8nData.reply });
    }

    console.error('❌ Flujo n8n no devolvió un "reply" válido');
    return res.status(500).json({ error: 'n8n no devolvió datos válidos' });
  } catch (error) {
    console.error('💥 Error en /filters/search:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Inicializar y arrancar
initializeServices().then(() => {
  app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
});
