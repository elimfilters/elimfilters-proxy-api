// utils.js

// Funciones de Nodemailer aquí. Asumimos que los detalles de nodemailer ya se configuraron.

export function logWebhookActivity(req, statusCode, startTime, resultOrError) {
    // ... (lógica de logging)
}

export async function sendCriticalAlert(to, subject, body) {
    // ... (lógica de envío de email)
}
