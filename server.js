// server.js
'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const GoogleSheetsConnector = require('./googleSheetsConnector'); // { create }
const SheetsProxy = require('./googleSheetsConnectorInstance');   // Proxy + setInstance

// (Opcional) detectionService si existe en tu repo
let detectionService = null;
try { detectionService = require('./detectionService'); } catch { /* no-op */ }

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

/** Health con verificación real contra Google Sheets */
app.get('/health', async (_req, res) => {
  try {
    // Si la instancia aún no está, dirá "no inicializada" y caerá al catch
    await SheetsProxy.ping();
    res.json({
      status: 'ok',
      service: 'elimfilters-proxy-api',
      version: process.env.API_VERSION || '3.0.0',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({
      status: 'error',
      service: 'elimfilters-proxy-api',
      error: e.message || String(e),
      timestamp: new Date().toISOString(),
    });
  }
});

/** Endpoint principal si tienes detectionService */
app.post('/api/detect-filter', async (req, res) => {
  try {
    if (!detectionService || typeof detectionService.detect !== 'function') {
      return res.status(501).json({ ok: false, error: 'DETECTION_SERVICE_NOT_AVAILABLE' });
    }
    const payload = req.body || {};
    const out = await detectionService.detect(payload); // tu implementación actual
    return res.json({ ok: true, ...out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'INTERNAL_ERROR' });
  }
});

/** Inicio con creación e inyección de la instancia en el Proxy */
async function start() {
  try {
    console.log('[BOOT] Inicializando Google Sheets…');
    const inst = await GoogleSheetsConnector.create(); // << factory (sin "new")
    SheetsProxy.setInstance(inst);
    console.log('[BOOT] Google Sheets listo. Proxy configurado.');

    // Si detectionService necesita el conector, inyecta el proxy:
    if (detectionService && typeof detectionService.setSheetsInstance === 'function') {
      detectionService.setSheetsInstance(SheetsProxy);
      console.log('[BOOT] detectionService vinculado al SheetsProxy.');
    }

    app.listen(PORT, () => console.log(`[BOOT] API escuchando en puerto ${PORT}`));
  } catch (err) {
    console.error('[BOOT][FATAL]', err);
    process.exit(1);
  }
}

start();

module.exports = app;
