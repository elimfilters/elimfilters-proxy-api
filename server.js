// server.js
// v3.0.0 – añade endpoints de respaldo y export

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodeCron = require('node-cron');

const GoogleSheetsService = require('./googleSheetsConnector');
const filterProcessor = require('./filterProcessor');

// instancia compartida de Sheets para otros módulos
const sheetsInstance = new GoogleSheetsService();
const setSheetsInstance = () => {
  // expone una referencia singleton para dataAccess y otros
  const bridgePath = require.resolve('./googleSheetsConnectorInstance');
  delete require.cache[bridgePath];
  require('./googleSheetsConnectorInstance').setInstance(sheetsInstance);
};

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'elimfilters-proxy-api',
    version: '3.0.0',
    rules_version: process.env.RULES_VERSION || '2.2.3',
    timestamp: new Date().toISOString()
  });
});

// Detect endpoint principal
app.post('/api/detect-filter', async (req, res) => {
  try {
    const out = await filterProcessor.processQuery({
      query: (req.body.query || '').trim(),
      family: (req.body.family || '').trim(),
      duty: (req.body.duty || '').trim()
    });
    if (!out.ok) {
      const code = out.code || 'ERROR';
      if (code === 'NOT_FOUND' || code === 'INVALID_SKU_FORMAT') {
        return res.status(200).json({ ok: false, code, query: req.body.query || '' });
      }
      return res.status(500).json({ ok: false, error: code });
    }
    res.json(out);
  } catch (e) {
    console.error('[detect-filter] error', e);
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

// --- Respaldo: snapshot manual
app.post('/api/backup/snapshot', async (req, res) => {
  try {
    const tab = await sheetsInstance.createSnapshotTab();
    const info = await sheetsInstance.snapshotMasterTo(tab);
    res.json({ ok: true, tab, rows: info.rows });
  } catch (e) {
    console.error('[snapshot]', e);
    res.status(500).json({ ok: false, error: 'SNAPSHOT_FAILED' });
  }
});

// --- Respaldo: export CSV del Master
app.get('/api/backup/export', async (req, res) => {
  try {
    const rows = await sheetsInstance.readRange(process.env.SHEET_RANGE || 'Master!A:Z');
    const csv = rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="master_export.csv"');
    res.send(csv);
  } catch (e) {
    console.error('[export]', e);
    res.status(500).json({ ok: false, error: 'EXPORT_FAILED' });
  }
});

// --- Cron diario: snapshot 03:15 UTC
if (process.env.ENABLE_SNAPSHOT_CRON === 'true') {
  nodeCron.schedule('15 3 * * *', async () => {
    try {
      const tab = await sheetsInstance.createSnapshotTab();
      await sheetsInstance.snapshotMasterTo(tab);
      console.log(`[SNAPSHOT] OK -> ${tab}`);
    } catch (e) {
      console.error('[SNAPSHOT] FAIL', e.message);
    }
  });
}

// Init
(async () => {
  await sheetsInstance.initialize();
  setSheetsInstance();
  app.listen(PORT, () => console.log(`ELIMFILTERS Proxy API v3.0.0 en puerto ${PORT}`));
})();

module.exports = app;
