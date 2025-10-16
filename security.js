// security.js

const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY; 
const ALLOWED_IPS = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim()) : [];

// 1. Middleware de Autenticación por API Key
export function authenticateWebhook(req, res, next) {
    const apiKey = req.headers['x-api-key'];

    if (!WEBHOOK_API_KEY || !apiKey || apiKey !== WEBHOOK_API_KEY) {
        return res.status(401).json({
            error: "UNAUTHORIZED",
            message: "API Key inválida o faltante. Acceso denegado."
        });
    }
    next();
}

// 2. Middleware de Lista Blanca de IPs
export function ipWhitelist(req, res, next) {
    if (ALLOWED_IPS.length === 0) return next(); 

    const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.ip;

    if (!ALLOWED_IPS.includes(clientIp)) {
        return res.status(403).json({
            error: "FORBIDDEN",
            message: "Acceso denegado: IP no autorizada."
        });
    }
    next();
}
