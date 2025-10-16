// server.js - Versión con endpoint webhook
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Middleware para validar API Key
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validKey = process.env.WEBHOOK_API_KEY || 'ZJ1q-M3t4l-F1lt3r-S3cr3t';
    
    if (apiKey !== validKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
    next();
};

// Endpoint de prueba
app.get("/", (req, res) => {
    res.status(200).json({
        message: "ELIMFILTERS API - Testing Mode",
        status: "ACTIVE",
        timestamp: new Date().toISOString()
    });
});

// Endpoint para recibir búsquedas de filtros
app.post("/webhook/filter-query", validateApiKey, (req, res) => {
    try {
        const { sku } = req.body;

        // Validar que SKU existe
        if (!sku) {
            return res.status(400).json({
                error: 'SKU is required',
                received: req.body
            });
        }

        console.log(`[${new Date().toISOString()}] Búsqueda de filtro: ${sku}`);

        // Aquí iría tu lógica de búsqueda de filtros
        // Por ahora devolvemos una respuesta de éxito
        res.status(200).json({
            message: 'Filter query received successfully',
            sku: sku,
            timestamp: new Date().toISOString(),
            status: 'processed'
        });
    } catch (error) {
        console.error('Error en webhook:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ ELIMFILTERS API running on port ${PORT}`);
    console.log(`📝 POST /webhook/filter-query available`);
});
