// utils.js (Utilidades - CommonJS)
/**
 * Funciones auxiliares para logging, alertas y monitoreo
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURACIÓN DE LOGGING
// ============================================================================

const LOG_DIR = process.env.LOG_DIR || './logs';
const ENABLE_FILE_LOGGING = process.env.ENABLE_FILE_LOGGING !== 'false';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // 'debug', 'info', 'warn', 'error'

// Crear directorio de logs si no existe
if (ENABLE_FILE_LOGGING && !fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log(`[UTILS] Directorio de logs creado: ${LOG_DIR}`);
}

/**
 * Niveles de logging
 */
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

/**
 * Obtener nivel numérico actual
 */
function getCurrentLogLevel() {
    return LOG_LEVELS[LOG_LEVEL] || LOG_LEVELS.info;
}

/**
 * Escribir en archivo de log
 */
function writeLogFile(filename, content) {
    if (!ENABLE_FILE_LOGGING) return;

    try {
        const filepath = path.join(LOG_DIR, filename);
        fs.appendFileSync(filepath, content + '\n');
    } catch (error) {
        console.error('[LOG FILE ERROR]', error.message);
    }
}

/**
 * Formatear timestamp
 */
function formatTimestamp(date = new Date()) {
    return date.toISOString();
}

/**
 * Formatear duración en milisegundos
 */
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

// ============================================================================
// LOGGING DE ACTIVIDAD DE WEBHOOK
// ============================================================================

/**
 * Registrar actividad del webhook
 */
async function logWebhookActivity(activityData) {
    try {
        const {
            requestId = 'UNKNOWN',
            sku = 'N/A',
            status = 'UNKNOWN',
            duration = 0,
            error = null,
            timestamp = formatTimestamp(),
            clientIp = 'N/A'
        } = activityData;

        // Formato de log
        const logEntry = {
            timestamp,
            requestId,
            clientIp,
            sku,
            status,
            duration_ms: duration,
            error: error ? error.message || String(error) : null
        };

        // Log a consola
        const logMessage = `[${timestamp}] [${requestId}] SKU: ${sku} | Status: ${status} | Duration: ${formatDuration(duration)}`;
        
        if (status === 'SUCCESS') {
            if (getCurrentLogLevel() <= LOG_LEVELS.info) {
                console.log(`✓ ${logMessage}`);
            }
        } else if (status === 'ERROR') {
            console.error(`✗ ${logMessage} | Error: ${error?.message || 'Unknown'}`);
        } else {
            console.warn(`⚠ ${logMessage}`);
        }

        // Log a archivo
        const logFileName = `webhook-activity-${new Date().toISOString().split('T')[0]}.log`;
        writeLogFile(logFileName, JSON.stringify(logEntry));

        // Si es error crítico, guardar en archivo separado
        if (status === 'ERROR') {
            const errorFileName = `webhook-errors-${new Date().toISOString().split('T')[0]}.log`;
            writeLogFile(errorFileName, JSON.stringify({
                ...logEntry,
                full_error: error?.stack || error
            }));
        }

        return true;
    } catch (err) {
        console.error('[LOGGING ERROR]', err.message);
        return false;
    }
}

/**
 * Log de una solicitud HTTP completada
 */
function logHttpRequest(req, res, duration) {
    const {
        method,
        path,
        headers,
        body
    } = req;

    const logEntry = {
        timestamp: formatTimestamp(),
        method,
        path,
        status_code: res.statusCode,
        duration_ms: duration,
        user_agent: headers['user-agent'] || 'N/A',
        content_type: headers['content-type'] || 'N/A'
    };

    writeLogFile(`http-requests-${new Date().toISOString().split('T')[0]}.log`, JSON.stringify(logEntry));
}

// ============================================================================
// ALERTAS CRÍTICAS (Email)
// ============================================================================

/**
 * Enviar alerta crítica por email
 * Requiere: NODEMAILER_USER, NODEMAILER_PASS, NODEMAILER_HOST, NODEMAILER_PORT
 */
async function sendCriticalAlert(alertData) {
    try {
        // Validar que las variables de entorno estén configuradas
        const requiredEnvVars = ['NODEMAILER_USER', 'NODEMAILER_PASS', 'NODEMAILER_HOST'];
        const missingVars = requiredEnvVars.filter(v => !process.env[v]);

        if (missingVars.length > 0) {
            console.warn(`[ALERT] No se puede enviar email. Variables faltantes: ${missingVars.join(', ')}`);
            return false;
        }

        // Importar nodemailer solo si se necesita
        const nodemailer = require('nodemailer');

        const {
            to = process.env.ALERT_EMAIL,
            subject = 'ELIMFILTERS Alert',
            body = '',
            requestId = 'N/A',
            errorMessage = '',
            sku = 'N/A'
        } = alertData;

        if (!to) {
            console.warn('[ALERT] ALERT_EMAIL no configurado');
            return false;
        }

        // Crear transporte de email
        const transporter = nodemailer.createTransport({
            host: process.env.NODEMAILER_HOST,
            port: parseInt(process.env.NODEMAILER_PORT || '587'),
            secure: process.env.NODEMAILER_SECURE === 'true', // true para 465, false para otros puertos
            auth: {
                user: process.env.NODEMAILER_USER,
                pass: process.env.NODEMAILER_PASS
            }
        });

        // Construir email HTML
        const htmlContent = `
            <h2>🚨 ELIMFILTERS Critical Alert</h2>
            <table border="1" cellpadding="10">
                <tr>
                    <td><strong>Timestamp</strong></td>
                    <td>${formatTimestamp()}</td>
                </tr>
                <tr>
                    <td><strong>Request ID</strong></td>
                    <td>${requestId}</td>
                </tr>
                <tr>
                    <td><strong>SKU</strong></td>
                    <td>${sku}</td>
                </tr>
                <tr>
                    <td><strong>Error</strong></td>
                    <td><code>${errorMessage}</code></td>
                </tr>
                <tr>
                    <td><strong>Environment</strong></td>
                    <td>${process.env.NODE_ENV || 'unknown'}</td>
                </tr>
            </table>
            <hr>
            <p>${body}</p>
        `;

        // Enviar email
        const mailOptions = {
            from: process.env.NODEMAILER_FROM || process.env.NODEMAILER_USER,
            to,
            subject: `[${process.env.NODE_ENV || 'prod'}] ${subject}`,
            html: htmlContent,
            text: body
        };

        await transporter.sendMail(mailOptions);
        console.log(`[ALERT] ✓ Email enviado a ${to}`);
        return true;

    } catch (error) {
        console.error('[ALERT ERROR]', error.message);
        return false;
    }
}

// ============================================================================
// SANITIZACIÓN DE ERRORES
// ============================================================================

/**
 * Sanitizar error para respuesta al cliente
 * Evita exponer información sensible
 */
function sanitizeError(error, exposeSensitive = false) {
    if (!error) return { message: 'Unknown error' };

    const sanitized = {
        message: error.message || String(error),
        ...(exposeSensitive && { stack: error.stack })
    };

    // En desarrollo, exponer más detalles
    if (process.env.NODE_ENV === 'development') {
        sanitized.stack = error.stack;
        sanitized.type = error.constructor.name;
    }

    return sanitized;
}

/**
 * Extraer información útil del error para logging
 */
function extractErrorInfo(error) {
    return {
        message: error.message || String(error),
        name: error.constructor.name,
        stack: error.stack,
        code: error.code,
        status: error.status
    };
}

// ============================================================================
// MONITOREO Y HEALTH CHECK
// ============================================================================

/**
 * Objeto para rastrear métricas del servidor
 */
const metrics = {
    startTime: Date.now(),
    requestCount: 0,
    errorCount: 0,
    lastErrorTime: null,
    totalDuration: 0
};

/**
 * Registrar métrica de solicitud
 */
function recordRequest(duration, isError = false) {
    metrics.requestCount++;
    metrics.totalDuration += duration;

    if (isError) {
        metrics.errorCount++;
        metrics.lastErrorTime = new Date();
    }
}

/**
 * Obtener estado de salud del servidor
 */
function getHealthStatus() {
    const uptime = Date.now() - metrics.startTime;
    const avgResponseTime = metrics.requestCount > 0 
        ? metrics.totalDuration / metrics.requestCount 
        : 0;

    return {
        status: 'HEALTHY',
        uptime_ms: uptime,
        uptime_human: formatDuration(uptime),
        request_count: metrics.requestCount,
        error_count: metrics.errorCount,
        error_rate: metrics.requestCount > 0 
            ? ((metrics.errorCount / metrics.requestCount) * 100).toFixed(2) + '%'
            : '0%',
        avg_response_time_ms: avgResponseTime.toFixed(2),
        last_error: metrics.lastErrorTime || 'N/A'
    };
}

/**
 * Generar reporte de salud
 */
function generateHealthReport() {
    const status = getHealthStatus();
    console.log('[HEALTH REPORT]');
    console.log(`  Status: ${status.status}`);
    console.log(`  Uptime: ${status.uptime_human}`);
    console.log(`  Requests: ${status.request_count}`);
    console.log(`  Errors: ${status.error_count} (${status.error_rate})`);
    console.log(`  Avg Response Time: ${status.avg_response_time_ms}ms`);
    
    return status;
}

// ============================================================================
// VALIDADORES
// ============================================================================

/**
 * Validar formato de SKU
 */
function isValidSku(sku) {
    if (!sku || typeof sku !== 'string') return false;
    const skuRegex = /^[A-Z0-9\-]{3,50}$/;
    return skuRegex.test(sku.toUpperCase().trim());
}

/**
 * Validar email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validar IP
 */
function isValidIp(ip) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipv4Regex.test(ip);
}

// ============================================================================
// EXPORTACIONES (CommonJS)
// ============================================================================

module.exports = {
    // Logging
    logWebhookActivity,
    logHttpRequest,
    writeLogFile,
    
    // Alerts
    sendCriticalAlert,
    
    // Errores
    sanitizeError,
    extractErrorInfo,
    
    // Monitoreo
    recordRequest,
    getHealthStatus,
    generateHealthReport,
    metrics,
    
    // Validadores
    isValidSku,
    isValidEmail,
    isValidIp,
    
    // Utilidades
    formatTimestamp,
    formatDuration,
    getCurrentLogLevel,
    LOG_LEVELS,
    LOG_DIR
};
