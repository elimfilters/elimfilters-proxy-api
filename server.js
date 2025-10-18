// server.js (Servidor Proxy - Versión Híbrida)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const axios = require('axios'); // <--- Asegúrate de tener axios: npm install axios

// Importar módulos locales
const security = require('./security');
const utils = require('./utils');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('[STARTUP] Iniciando ELIMFILTERS Proxy API (Modo Híbrido)...');
console.log(`[CONFIG] Ambiente: ${process.env.NODE_ENV || 'development'}`);

// ============================================================================
// MIDDLEWARE GLOBAL
// ============================================================================
const corsOptions = {
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
    maxAge: 3600
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// Logging de requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================================================
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mode: 'HYBRID (n8n Worker)'
    });
});

// ============================================================================
// RUTAS PROTEGIDAS (con autenticación y rate limiting)
// ============================================================================
const webhookLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'TOO_MANY_REQUESTS', message: 'Demasiadas solicitudes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Aplicar seguridad a la ruta del webhook
app.use('/webhook/', webhookLimiter, security.secureWebhook);

/**
 * WEBHOOK PROXY: Reenvía la petición al flujo de n8n
 * POST /webhook/filter-query
 * Body: { q: "CODE_TO_SEARCH" }
 */
app.post('/webhook/filter-query', async (req, res) => {
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
        console.log(`[${requestId}] POST /webhook/filter-query - Reenviando a n8n`);

        // Validar que el body exista
        if (!req.body || !req.body.q) {
            console.warn(`[${requestId}] Body vacío o campo 'q' faltante`);
            return res.status(400).json({
                results: [{ error: 'MISSING_QUERY', message: 'Campo "q" requerido en el body', ok: false }],
                metadata: { success: false }
            });
        }

        // === NUEVA LÓGICA: LLAMAR A N8N ===
        const n8nWebhookUrl = process.env.N8N_WORKFLOW_WEBHOOK_URL;
        if (!n8nWebhookUrl) {
            throw new Error('N8N_WORKFLOW_WEBHOOK_URL no está configurada en el .env');
        }

        // Reenviar la petición a n8n
        const n8nResponse = await axios.post(n8nWebhookUrl, {
            q: req.body.q
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000 // Timeout de 30 segundos para la llamada a n8n
        });

        const result = n8nResponse.data;
        const duration = Date.now() - startTime;
        console.log(`[${requestId}] ✓ Respuesta de n8n recibida en ${duration}ms`);

        // Registrar actividad exitosa
        await utils.logWebhookActivity({
            requestId,
            sku: req.body.q,
            status: 'SUCCESS',
            duration,
            timestamp: new Date().toISOString()
        });

        // Devolver la respuesta de n8n directamente al cliente
        return res.status(200).json(result);

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[${requestId}] ✗ Error después de ${duration}ms:`, error.message);

        // Registrar error
        await utils.logWebhookActivity({
            requestId,
            sku: req.body?.q || 'UNKNOWN',
            status: 'ERROR',
            error: utils.sanitizeError(error),
            duration,
            timestamp: new Date().toISOString()
        });

        // Determinar código de status HTTP
        let statusCode = 500;
        let errorResponse = { error: 'INTERNAL_SERVER_ERROR', message: 'Error procesando la solicitud' };

        // Si es un error de axios (ej. n8n no responde)
        if (error.code === 'ECONNABORTED') {
            statusCode = 504; // Gateway Timeout
            errorResponse = { error: 'N8N_TIMEOUT', message: 'El servicio de búsqueda tardó demasiado en responder.' };
        } else if (error.response) {
            // n8n devolvió un error (ej. 404, 500)
            statusCode = error.response.status;
            errorResponse = error.response.data; // Devolver el error de n8n
        }

        return res.status(statusCode).json({
            results: [{ ...errorResponse, ok: false }],
            metadata: { success: false }
        });
    }
});

// ... (El resto del archivo: debug endpoint, 404, global error handler, graceful shutdown, etc., está perfecto y no necesita cambios) ...

// ============================================================================
// MANEJO DE RUTAS NO ENCONTRADAS
// ============================================================================
app.use((req, res) => {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: `Ruta ${req.method} ${req.path} no existe`,
        available_routes: ['GET /health', 'POST /webhook/filter-query']
    });
});

// ============================================================================
// MANEJO DE ERRORES GLOBAL
// ============================================================================
app.use((error, req, res, next) => {
    console.error('[GLOBAL ERROR HANDLER]', error);
    res.status(error.status || 500).json({
        error: 'UNHANDLED_ERROR',
        message: 'Error no controlado en el servidor',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] SIGTERM recibido. Cerrando servidor...');
    server.close(() => {
        console.log('[SHUTDOWN] Servidor cerrado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('[SHUTDOWN] SIGINT recibido. Cerrando servidor...');
    server.close(() => {
        console.log('[SHUTDOWN] Servidor cerrado');
        process.exit(0);
    });
});

// ============================================================================
// INICIO DEL SERVIDOR
// ============================================================================
const server = app.listen(PORT, () => {
    console.log(`[STARTUP] ✓ ELIMFILTERS Proxy API (Modo Híbrido) escuchando en puerto ${PORT}`);
    console.log(`[STARTUP] ✓ Health check: http://localhost:${PORT}/health`);
    console.log(`[STARTUP] ✓ Webhook Proxy: POST http://localhost:${PORT}/webhook/filter-query`);
});

process.on('uncaughtException', (error) => {
    console.error('[UNCAUGHT EXCEPTION]', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION]', reason);
    process.exit(1);
});

module.exports = app;
