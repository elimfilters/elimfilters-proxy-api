// server.js - Versión con endpoint webhook
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Middleware para validar API Key (DESACTIVADO TEMPORALMENTE)
const validateApiKey = (req, res, next) => {
    // console.log('API Key recibida:', req.headers['x-api-key']);
    next(); // Por ahora, saltamos la validación
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
