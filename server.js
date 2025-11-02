require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const detectionService = require('./detectionService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ELIMFILTERS Proxy API',
    version: '3.3.0',
    endpoints: {
      health: 'GET /health',
      detect: 'POST /api/detect-filter'
    }
  });
});

// Main route
app.post('/api/detect-filter', async (req, res) => {
  try {
    let { query } = req.body;
    if (!query) {
      return res.status(400).json({ status: 'ERROR', message: 'Missing query parameter' });
    }

    // Normaliza
    query = query.trim().toUpperCase();

    // Detecta
    const result = await detectionService.detectFilter(query);

    if (!result || result.status !== 'OK') {
      return res.json({ status: 'ERROR', message: `No information found for ${query}` });
    }

    return res.json(result);
  } catch (err) {
    console.error('detect-filter error:', err);
    res.status(500).json({ status: 'ERROR', message: 'Internal Server Error', details: err.message });
  }
});

// Listener
app.listen(PORT, () => console.log(`✅ ELIMFILTERS Proxy API running on port ${PORT}`));
