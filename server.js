// server.js
// ELIMFILTERS Proxy API v3.3.0

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { detectFilter } = require('./detectionService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(rateLimit({ windowMs: 60 * 1000, max: 100 }));

// Health endpoint
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

// Detect filter
app.post('/api/detect-filter', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ status: 'ERROR', message: 'Missing query' });

    const result = detectFilter(query);
    return res.json(result);

  } catch (err) {
    console.error('Error in detect-filter:', err);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Internal failure in detect-filter',
      details: err.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ ELIMFILTERS Proxy API v3.3.0 running on port ${PORT}`);
});
