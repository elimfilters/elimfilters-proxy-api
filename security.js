// security.js

const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY; 
const ALLOWED_IPS = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim()) : [];

export function authenticateWebhook(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    // ... (lógica)
    next();
}

export function ipWhitelist(req, res, next) {
    // ... (lógica)
    next();
}
