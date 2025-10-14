// security.js

// Lee la API Key de las variables de entorno de Railway
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY; 
// Lista de IPs permitidas (Lee un string separado por comas de Railway)
const ALLOWED_IPS = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim()) : [];

// 1. Middleware de Autenticación por API Key (CAPA 1)
function authenticateWebhook(req, res, next) {
    const apiKey = req.headers['x-api-key'];

    if (!WEBHOOK_API_KEY || !apiKey || apiKey !== WEBHOOK_API_KEY) {
        console.warn(`[SEGURIDAD] Intento de acceso no autorizado. API Key faltante/inválida.`);
        return res.status(401).json({
            error: "UNAUTHORIZED",
            message: "API Key inválida o faltante. Acceso denegado."
        });
    }
    next();
}

// 2. Middleware de Lista Blanca de IPs (CAPA 3)
function ipWhitelist(req, res, next) {
    // Si no hay IPs permitidas configuradas, se permite el paso por defecto.
    if (ALLOWED_IPS.length === 0) return next(); 

    // Obtener la IP real del cliente (crucial en entornos cloud como Railway)
    const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.ip;

    if (!ALLOWED_IPS.includes(clientIp)) {
        console.warn(`[SEGURIDAD] IP no autorizada: ${clientIp}`);
        return res.status(403).json({
            error: "FORBIDDEN",
            message: "Acceso denegado: IP no autorizada."
        });
    }
    next();
}

module.exports = {
    authenticateWebhook,
    ipWhitelist
};
