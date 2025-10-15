// server.js (Versión Blindada y Corregida - Usa el flujo de Nodos 1, 6, y 7)

const express = require('express');
const cors = require('cors'); 
const { processFilterCode } = require('./filterProcessor'); // Llama a la lógica central de tu catálogo (Nodos 2-5)
const { authenticateWebhook, ipWhitelist } = require('./security'); // NODO 7: Seguridad
const { logWebhookActivity, sendCriticalAlert } = require('./utils'); // NODO 7: Monitoreo

const app = express();
const PORT = process.env.PORT || 3000; // Usa el puerto de Railway
const ALERT_EMAIL = "elimfilters@gmail.com"; 

// --- MIDDLEWARE ---
// Permite peticiones JSON
app.use(express.json());
// CORS: Permite que tu dominio de WP se conecte (ajusta el origen si es necesario)
app.use(cors({ origin: 'https://www.elimfilters.com' })); 

// --- NODO 1: WEBHOOK ENDPOINT (Blindado) ---
// El endpoint /webhook/filter-query es el que usamos para la prueba POST
app.post(
    '/webhook/filter-query', 
    // Middleware de seguridad:
    ipWhitelist,         // Restringe el acceso por IP (si la variable ALLOWED_IPS está configurada)
    authenticateWebhook, // CRÍTICO: Verifica la API Key (x-api-key)
    // Incluir aquí el Rate Limiting (si lo instalaste)
    async (req, res) => {
        const startTime = Date.now();
        const inputCode = req.body.code;
        let finalStatus = 500;
        
        try {
            // El corazón del flujo: Llama a Nodos 2, 3, 4, 4.5, 5
            const result = await processFilterCode(inputCode, req.body.options); 
            
            // --- ÉXITO (200 OK) ---
            finalStatus = 200;
            res.status(finalStatus).json(result);

        } catch (error) {
            // --- NODO 6: CAPTURA DE ERRORES (400 y 500) ---
            
            if (error.status === 400) {
                // FALLO DE NEGOCIO (INVALID_CODE o NO ENCONTRADO)
                finalStatus = 400;
                res.status(finalStatus).json(error.safeErrorResponse);
            } else { 
                // FALLO CRÍTICO (500) - DATA_UNCERTAINTY o Error DB
                await sendCriticalAlert(ALERT_EMAIL, `[CRÍTICO] Fallo de Servidor/Datos para ${inputCode}`, `Error: ${error.message}`);
                finalStatus = 500;
                const safeResponse = error.safeErrorResponse || { results: [{ error: "INTERNAL_SERVER_ERROR", message: "Error crítico de servidor.", ok: false }] };
                res.status(finalStatus).json(safeResponse);
            }

        } finally {
            // NODO 7: Logging (Ejecuta la función logWebhookActivity con los datos)
            logWebhookActivity(req, finalStatus, startTime);
        }
    }
);

app.listen(PORT, () => {
    console.log(`✅ ELIMFILTERS API running on port ${PORT}`);
});
