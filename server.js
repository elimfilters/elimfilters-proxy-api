require('dotenv').config();
const express = require('express');
const cors = require('cors');

const GoogleSheetsConnector = require('./googleSheetsConnector'); // { create }
const sheetsProxy = require('./googleSheetsConnectorInstance');   // Proxy + setInstance

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

async function start() {
  try {
    const inst = await GoogleSheetsConnector.create(); // << sin "new"
    sheetsProxy.setInstance(inst);

    app.get('/health', async (req, res) => {
      try {
        await sheetsProxy.ping();
        res.status(200).json({ status: 'ok' });
      } catch (e) {
        res.status(500).json({ status: 'error', detail: e.message });
      }
    });

    // Ejemplo de lectura
    app.get('/api/sheet/read', async (req, res) => {
      try {
        const range = req.query.range;
        const rows = await sheetsProxy.read(range);
        res.json({ rows });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    app.listen(PORT, () => {
      console.log(`Server listening on ${PORT}`);
    });
  } catch (err) {
    console.error('Fallo al iniciar el servidor:', err);
    process.exit(1);
  }
}

start();
