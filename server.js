// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Servicio REAL (la clase). Debe existir en ./googleSheetsConnector.js
// y exportar { GoogleSheetsService }
const { GoogleSheetsService } = require('./googleSheetsConnector');

// Puente/proxy que reexpone los métodos de la instancia real
const sheetsBridge = require('./googleSheetsConnectorInstance');

const PORT = process.env.PORT || 3000;

async function start() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // 1) Crear e inicializar la instancia real del servicio
  const sheets = new GoogleSheetsService();
  if (typeof sheets.initialize === 'function') {
    await sheets.initialize(); // no hace nada si no está implementado
  }

  // 2) Inyectar la instancia en el puente/proxy
  sheetsBridge.setInstance(sheets);

  // --- Rutas mínimas ---
  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'elimfilters-proxy-api',
      version: '3.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // Ejemplo opcional: usar el proxy (descomenta si tienes implementado readData)
  // app.get('/api/sheets/sample', async (_req, res) => {
  //   try {
  //     const rows = await sheetsBridge.readData('Hoja1!A1:C10');
  //     res.json({ ok: true, rows });
  //   } catch (err) {
  //     res.status(500).json({ ok: false, error: String(err.message || err) });
  //   }
  // });

  app.listen(PORT, () => {
    console.log(`API up on port ${PORT}`);
  });
}

// Arranque con manejo básico de errores
start().catch((err) => {
  console.error('Fallo al iniciar el servidor:', err);
  process.exit(1);
});
