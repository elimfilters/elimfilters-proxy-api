require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'ELIMFILTERS API',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/api/products'
    ]
  });
});

// Products endpoint (placeholder)
app.get('/api/products', async (req, res) => {
  try {
    res.json({ 
      success: true,
      message: 'Products endpoint working',
      data: []
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
