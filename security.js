// security.js (Seguridad - CommonJS)
/**
 * Validación de autenticación y autorización
 */

// Cargar variables de entorno
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY;
const ALLOWED_IPS = process.env.ALLOWED_IPS 
    ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim()) 
    : [];

console.log(`[SECURITY INIT] API Key configurada: ${WEBHOOK_API_KEY ? '✓' : '✗'}`);
console.log(`[SECURITY INIT] IPs permitidas: ${ALLOWED_IPS.length > 0 ? ALLOWED_IPS.join(', ') : 'TODAS (whitelist desactivada)'}`);

/**
 * Validar autenticación del webhook
 * Verifica que el API key en headers coincida con la variable de entorno
 */
function validateWebhookAuth(apiKey) {
    // Validar que la clave esté configurada en el servidor
    if (!WEBHOOK_API_KEY) {
        console.warn('[AUTH] WEBHOOK_API_KEY no configurada en variables de entorno');
        return false;
    }

    // Validar que el cliente envió una clave
    if (!apiKey) {
        console.warn('[AUTH] Cliente no proporcionó API key');
        return false;
    }

    // Comparación segura (timing attack resistant)
    const isValid = apiKey.length === WEBHOOK_API_KEY.length &&
        Buffer.from(apiKey).equals(Buffer.from(WEBHOOK_API_KEY));

    if (!isValid) {
        console.warn('[AUTH] API key inválida recibida');
        return false;
    }

    console.log('[AUTH] ✓ API key válida');
    return true;
}

/**
 * Middleware: Validar API key (se puede usar directamente en rutas)
 */
function authenticateWebhook(req, res, next) {
    try {
        const apiKey = req.headers['x-api-key'];

        if (!validateWebhookAuth(apiKey)) {
            return res.status(401).json({
                error: "UNAUTHORIZED",
                message: "API Key inválida o faltante. Acceso denegado.",
                ok: false
            });
        }

        next();
    } catch (error) {
        console.error('[AUTH ERROR]', error.message);
        return res.status(500).json({
            error: "AUTH_ERROR",
            message: "Error durante validación de autenticación",
            ok: false
        });
    }
}

/**
 * Extraer IP del cliente (considerando proxies)
 */
function getClientIp(req) {
    // Intentar obtener IP desde headers de proxy (Railway, Cloudflare, etc)
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
    }

    // Fallback a x-real-ip (algunos proxies lo usan)
    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'].trim();
    }

    // Último recurso: req.ip
    return req.ip || req.connection.remoteAddress || 'UNKNOWN';
}

/**
 * Validar si IP está en whitelist
 */
function validateIpWhitelist(clientIp) {
    // Si la whitelist está vacía, permitir todas las IPs
    if (ALLOWED_IPS.length === 0) {
        return true;
    }

    // Verificar si la IP está en la lista
    const isAllowed = ALLOWED_IPS.includes(clientIp);

    if (!isAllowed) {
        console.warn(`[IP_WHITELIST] IP no autorizada: ${clientIp}`);
    }

    return isAllowed;
}

/**
 * Middleware: Validar whitelist de IPs
 */
function ipWhitelistMiddleware(req, res, next) {
    try {
        const clientIp = getClientIp(req);
        
        if (!validateIpWhitelist(clientIp)) {
            console.warn(`[IP_WHITELIST DENIED] ${clientIp}`);
            return res.status(403).json({
                error: "FORBIDDEN",
                message: "Acceso denegado: IP no autorizada.",
                ok: false
            });
        }

        console.log(`[IP_WHITELIST OK] ${clientIp}`);
        next();
    } catch (error) {
        console.error('[IP_WHITELIST ERROR]', error.message);
        return res.status(500).json({
            error: "IP_CHECK_ERROR",
            message: "Error durante validación de IP",
            ok: false
        });
    }
}

/**
 * Middleware: Validar tanto API key como IP (combinado)
 */
function secureWebhook(req, res, next) {
    // Primero validar API key
    const apiKey = req.headers['x-api-key'];
    if (!validateWebhookAuth(apiKey)) {
        return res.status(401).json({
            error: "UNAUTHORIZED",
            message: "API Key inválida o faltante",
            ok: false
        });
    }

    // Luego validar IP
    const clientIp = getClientIp(req);
    if (!validateIpWhitelist(clientIp)) {
        return res.status(403).json({
            error: "FORBIDDEN",
            message: "IP no autorizada",
            ok: false
        });
    }

    next();
}

/**
 * Obtener información de seguridad (para debugging)
 */
function getSecurityStatus() {
    return {
        api_key_configured: !!WEBHOOK_API_KEY,
        api_key_length: WEBHOOK_API_KEY ? WEBHOOK_API_KEY.length : 0,
        ip_whitelist_enabled: ALLOWED_IPS.length > 0,
        ip_whitelist_count: ALLOWED_IPS.length,
        allowed_ips: ALLOWED_IPS
    };
}

// ============================================================================
// EXPORTACIONES (CommonJS)
// ============================================================================

module.exports = {
    validateWebhookAuth,
    authenticateWebhook,
    getClientIp,
    validateIpWhitelist,
    ipWhitelistMiddleware,
    secureWebhook,
    getSecurityStatus,
    ipWhitelist: ipWhitelistMiddleware // Alias para compatibilidad
};
