// server.js (Servidor Blindado - CommonJS)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Importar módulos locales (sin .js)
const filterProcessor = require('./filterProcessor');
const { validateWebhookAuth, ipWhitelist } = require('./security');
const { logWebhookActivity, sanitizeError } = require('./utils');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('[STARTUP] Iniciando ELIMFILTERS Proxy API...');
console.log(`[CONFIG] Ambiente: ${process.env.NODE_ENV || 'development'}`);

// ============================================================================
// MIDDLEWARE GLOBAL
// ============================================================================

// CORS - Configuración segura
const corsOptions = {
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
    maxAge: 3600
};
app.use(cors(corsOptions));

// Parseo de JSON
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por ventana
    message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/webhook/', limiter);

// Logging de requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================================================
// VALIDACIÓN DE SEGURIDAD
// ============================================================================

// Middleware de autenticación para webhook
app.use('/webhook/', (req, res, next) => {
    try {
        // Validar IP si whitelist está activo
        if (process.env.ENABLE_IP_WHITELIST === 'true') {
            const clientIp = req.ip || req.connection.remoteAddress;
            if (!ipWhitelist.includes(clientIp)) {
                console.warn(`[SECURITY] IP no autorizada: ${clientIp}`);
                return res.status(403).json({
                    error: 'FORBIDDEN',
                    message: 'IP no autorizada'
                });
            }
        }

        // Validar API key
        const apiKey = req.headers['x-api-key'];
        if (!validateWebhookAuth(apiKey)) {
            console.warn(`[SECURITY] API key inválida o ausente`);
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'API key inválida o ausente'
            });
        }

        next();
    } catch (error) {
        console.error('[SECURITY ERROR]', error.message);
        return res.status(500).json({
            error: 'SECURITY_CHECK_FAILED',
            message: 'Error durante validación de seguridad'
        });
    }
});

// ============================================================================
// RUTAS
// ============================================================================

/**
 * Health check
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * WEBHOOK PRINCIPAL: Procesar código de filtro
 * POST /webhook/filter-query
 * Body: { sku: "CODE_TO_SEARCH" }
 */
app.post('/webhook/filter-query', async (req, res) => {
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
        console.log(`[${requestId}] POST /webhook/filter-query`);

        // Validar que el body exista
        if (!req.body) {
            console.warn(`[${requestId}] Body vacío`);
            return res.status(400).json({
                results: [{
                    error: 'EMPTY_BODY',
                    message: 'El body de la solicitud está vacío',
                    ok: false
                }],
                metadata: { success: false }
            });
        }

        // Extraer SKU del body
        const { sku } = req.body;

        if (!sku) {
            console.warn(`[${requestId}] SKU no proporcionado`);
            return res.status(400).json({
                results: [{
                    error: 'MISSING_SKU',
                    message: 'Campo "sku" requerido en el body',
                    ok: false
                }],
                metadata: { success: false }
            });
        }

        console.log(`[${requestId}] Procesando SKU: ${sku}`);

        // Procesar el filtro
        const result = await filterProcessor.processFilterCode(sku);

        // Validar respuesta
        if (!result) {
            throw new Error('processFilterCode retornó null/undefined');
        }

        // Logging de éxito
        const duration = Date.now() - startTime;
        console.log(`[${requestId}] ✓ Éxito en ${duration}ms`);

        // Registrar actividad
        await logWebhookActivity({
            requestId,
            sku,
            status: 'SUCCESS',
            duration,
            timestamp: new Date().toISOString()
        });

        // Enviar respuesta
        return res.status(200).json(result);

    } catch (error) {
        const duration = Date.now() - startTime;

        console.error(`[${requestId}] ✗ Error después de ${duration}ms:`, error.message);
        console.error(`[${requestId}] Stack:`, error.stack);

        // Registro de error
        await logWebhookActivity({
            requestId,
            sku: req.body?.sku || 'UNKNOWN',
            status: 'ERROR',
            error: sanitizeError(error),
            duration,
            timestamp: new Date().toISOString()
        });

        // Determinar código de status HTTP
        let statusCode = 500;
        let errorResponse = {
            error: 'INTERNAL_SERVER_ERROR',
            message: 'Error procesando la solicitud'
        };

        // Si el error tiene estructura conocida
        if (error.status) {
            statusCode = error.status;
            if (error.safeErrorResponse) {
                return res.status(statusCode).json(error.safeErrorResponse);
            }
        }

        // Respuesta de error genérica
        return res.status(statusCode).json({
            results: [{
                ...errorResponse,
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                ok: false
            }],
            metadata: { success: false }
        });
    }
});

/**
 * Debug endpoint (solo en desarrollo)
 */
if (process.env.NODE_ENV === 'development') {
    app.get('/debug/config', (req, res) => {
        res.json({
            node_env: process.env.NODE_ENV,
            port: PORT,
            cors_enabled: true,
            rate_limiting: true,
            ip_whitelist_enabled: process.env.ENABLE_IP_WHITELIST === 'true'
        });
    });
}

// ============================================================================
// MANEJO DE RUTAS NO ENCONTRADAS
// ============================================================================

app.use((req, res) => {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: `Ruta ${req.method} ${req.path} no existe`,
        available_routes: [
            'GET /health',
            'POST /webhook/filter-query'
        ]
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
    console.log(`[STARTUP] ✓ ELIMFILTERS Proxy API escuchando en puerto ${PORT}`);
    console.log(`[STARTUP] ✓ Health check: http://localhost:${PORT}/health`);
    console.log(`[STARTUP] ✓ Webhook: POST http://localhost:${PORT}/webhook/filter-query`);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    console.error('[UNCAUGHT EXCEPTION]', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION]', reason);
    process.exit(1);
});

module.exports = app;
