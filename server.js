const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const N8N_WEBHOOK_URL = 'https://elimfilterscross.app.n8n.cloud/webhook/ELIMFILTERS_SEARCH_MASTER';
const TIMEOUT_MS = 15000;

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://www.elimfilters.com',
      'https://elimfilters.com'
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function cleanQuery(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return input
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

function fetchWithTimeout(url, options, timeout = TIMEOUT_MS) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    )
  ]);
}

app.get('/partsearch', async (req, res) => {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[${requestId}] Request received:`, req.query);
  
  try {
    const rawQuery = req.query.q || '';
    const cleanedQuery = cleanQuery(rawQuery);
    
    if (!cleanedQuery) {
      console.log(`[${requestId}] Empty query received`);
      return res.status(400).json({
        ok: false,
        results: [],
        message: 'Query parameter "q" is required and cannot be empty',
        requestId
      });
    }
    
    if (cleanedQuery.length > 100) {
      console.log(`[${requestId}] Query too long: ${cleanedQuery.length} chars`);
      return res.status(400).json({
        ok: false,
        results: [],
        message: 'Query exceeds maximum length of 100 characters',
        requestId
      });
    }
    
    const lang = req.query.lang || 'en';
    
    console.log(`[${requestId}] Cleaned query: ${cleanedQuery}, Language: ${lang}`);
    
    const n8nUrl = `${N8N_WEBHOOK_URL}?q=${encodeURIComponent(cleanedQuery)}&lang=${lang}`;
    
    console.log(`[${requestId}] Calling n8n webhook...`);
    
    const n8nResponse = await fetchWithTimeout(n8nUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ELIMFILTERS-Proxy/1.0'
      }
    }, TIMEOUT_MS);
    
    const elapsedTime = Date.now() - startTime;
    console.log(`[${requestId}] n8n responded in ${elapsedTime}ms with status ${n8nResponse.status}`);
    
    const n8nData = await n8nResponse.json();
    
    if (n8nData.error || !n8nResponse.ok) {
      console.log(`[${requestId}] n8n returned error:`, n8nData);
      return res.status(n8nResponse.status || 500).json({
        ok: false,
        results: [],
        message: n8nData.message || 'Error processing request in n8n',
        error: n8nData.code || 'UNKNOWN_ERROR',
        requestId
      });
    }
    
    if (!n8nData.results || !Array.isArray(n8nData.results)) {
      console.log(`[${requestId}] Invalid response structure from n8n`);
      return res.status(500).json({
        ok: false,
        results: [],
        message: 'Invalid response structure from backend',
        requestId
      });
    }
    
    console.log(`[${requestId}] Success! Returning ${n8nData.results.length} results`);
    
    return res.status(200).json({
      ok: true,
      results: n8nData.results,
      message: 'ok',
      _meta: {
        cached: n8nData._meta?.cached || false,
        validated: n8nData._meta?.validated || false,
        responseTime: elapsedTime,
        requestId
      }
    });
    
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    
    if (error.message === 'Timeout') {
      console.log(`[${requestId}] Timeout after ${elapsedTime}ms`);
      return res.status(504).json({
        ok: false,
        results: [],
        message: 'timeout',
        error: 'TIMEOUT',
        requestId
      });
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error(`[${requestId}] Network error:`, error.message);
      return res.status(503).json({
        ok: false,
        results: [],
        message: 'Backend service unavailable',
        error: 'SERVICE_UNAVAILABLE',
        requestId
      });
    }
    
    console.error(`[${requestId}] Unexpected error:`, error);
    return res.status(500).json({
      ok: false,
      results: [],
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
      requestId
    });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ELIMFILTERS Proxy API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    results: [],
    message: 'Endpoint not found',
    error: 'NOT_FOUND'
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    ok: false,
    results: [],
    message: 'Internal server error',
    error: 'INTERNAL_ERROR'
  });
});

app.listen(PORT, () => {
  console.log(`✅ ELIMFILTERS Proxy API running on port ${PORT}`);
  console.log(`📍 Endpoint: https://api.elimfilters.com/partsearch`);
  console.log(`🔗 n8n webhook: ${N8N_WEBHOOK_URL}`);
  console.log(`⏱️  Timeout: ${TIMEOUT_MS}ms`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
