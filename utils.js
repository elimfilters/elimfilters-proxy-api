// utils.js

const nodemailer = require('nodemailer'); 
// Nota: Necesitas instalar 'nodemailer' (npm install nodemailer)

// Configuración de Email (usando variables de entorno de Railway)
const transporter = nodemailer.createTransport({
    service: 'gmail', // Puedes cambiar esto a SendGrid, Mailgun, etc.
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 1. Función de Logueo (Para el dashboard de Railway)
function logWebhookActivity(req, statusCode, startTime, resultOrError) {
    const processingTime = Date.now() - startTime;
    const isSuccess = statusCode === 200;

    const logEntry = {
        timestamp: new Date().toISOString(),
        status: statusCode,
        query: req.body.code,
        processing_ms: processingTime,
        result_ok: isSuccess,
        // Agrega más detalles del resultado si es necesario
    };
    
    // El log se imprime a la consola y Railway lo captura
    console.log(JSON.stringify(logEntry)); 
}

// 2. Función de Alerta Crítica por Email
async function sendCriticalAlert(to, subject, body) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error("No se enviará la alerta: Credenciales de email faltantes en Railway.");
        return;
    }

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: to,
            subject: subject,
            text: body + ` (Enviado a las ${new Date().toISOString()})`,
        });
        console.log(`[ALERTA] Email enviado exitosamente a ${to}`);
    } catch (error) {
        console.error("[ALERTA] ERROR al enviar correo de alerta:", error);
    }
}

module.exports = {
    logWebhookActivity,
    sendCriticalAlert
};
