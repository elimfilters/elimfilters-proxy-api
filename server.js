
/**
 * REST endpoint usado por chatbot y WP
 */
app.post('/api/v1/filters/search', async (req, res) => {
  try {
    const q =
      req.body?.body?.query ||
      req.body?.query ||
      req.body?.q ||
      req.body?.message ||
      '';
    const sessionId = req.body?.sessionId || 'anon';
    if (!q.trim()) return res.status(400).json({ success: false, error: 'Query required' });

    const fx = await forwardToN8N(q, { sessionId, origin: req.headers.origin });
    return res.status(fx.status).json(fx.body);
  } catch (e) {
    console.error('❌ Proxy /api/v1/filters/search error:', e);
    return res.status(502).json({ success: false, error: 'proxy_failed' });
  }
});

/**
 * APIs existentes (Sheets opcional)
 */
app.get('/api/products', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success: false, error: 'Service unavailable' });
    const query = req.query.q || '';
    const products = await sheetsInstance.searchProducts(query);
    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ success: false, error: 'Error fetching products' });
  }
});

app.get('/api/products/:sku', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success: false, error: 'Service unavailable' });
    const { sku } = req.params;
    const products = await sheetsInstance.searchProducts(sku);
    if (products.length === 0) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: products[0] });
  } catch (error) {
    console.error('❌ Error fetching product:', error);
    res.status(500).json({ success: false, error: 'Error fetching product' });
  }
});

app.post('/api/detect-filter', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success: false, error: 'Service unavailable' });
    const { query } = req.body;
    if (!query || query.trim() === '') return res.status(400).json({ success: false, error: 'Query required' });
    const result = await detectionService.detectFilter(query);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Error detecting filter:', error);
    res.status(500).json({ success: false, error: 'Error detecting filter' });
  }
});

app.post('/api/generate-sku', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success: false, error: 'Service unavailable' });
    const { filterType, family, specs, oemCodes, crossReference, rawData } = req.body;
    if (!filterType || !family || !rawData) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields',
        message: 'Required: filterType, family, rawData'
      });
    }

    const result = businessLogic.generateSKU(family, rawData.duty_level, specs || {}, oemCodes || [], crossReference || [], rawData);
    
    res.json({
      success: true,
      data: {
        sku: result.sku,
        filterType,
        family,
        dutyLevel: rawData.duty_level,
        timestamp: new Date().toISOString(),
        details: result.details || {}
      }
    });
  } catch (error) {
    console.error('❌ Error generating SKU:', error);
    res.status(500).json({ success: false, error: 'Error generating SKU', message: error.message });
  }
});

app.post('/api/process-filter', async (req, res) => {
  try {
    if (!sheetsInstance) return res.status(503).json({ success: false, error: 'Service unavailable' });
    const { family, specs, oemCodes, crossReference, rawData } = req.body;
    if (!family || !rawData) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields',
        message: 'Required: family, rawData'
      });
    }

    const processedData = businessLogic.processFilterData(family, specs || {}, oemCodes || [], crossReference || [], rawData);
    res.json({ success: true, data: processedData });
  } catch (error) {
    console.error('❌ Error processing filter data:', error);
    res.status(500).json({ success: false, error: 'Error processing filter data' });
  }
});

// ============================================================================
// Error handlers
// ============================================================================
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
});

// ============================================================================
// START SERVER
// ============================================================================
async function safeInit() {
  loadRulesMaster();

  if (process.env.SKIP_SHEETS_INIT === 'true') {
    console.warn('⚠️  SKIP_SHEETS_INIT=true → Google Sheets disabled');
    return;
  }
  
  try {
    await initializeServices();
  } catch (e) {
    console.error('⚠️  Sheets init FAILED. Server up. Reason:', e?.message);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on port ${PORT}`);
  console.log(`📊 Health: GET /health`);
  console.log(`🔄 Proxy:  POST /api/v1/filters/search → ${N8N_URL || 'MISSING'}`);
  safeInit();
});

process.on('SIGTERM', () => {
  console.log('✅ SIGTERM received');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('✅ SIGINT received');
  process.exit(0);
});

module.exports = app;
