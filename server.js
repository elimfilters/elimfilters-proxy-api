const express = require('express');
const app = express();
const rateLimit = require('express-rate-limit'); // Para la defensa anti-scraping (Capa 2)

// --- 1. Importar la lógica central y las utilidades (Deben crearse en archivos separados) ---
const { processFilterCode } = require('./filterProcessor'); 
const { logWebhookActivity, sendCriticalAlert } = require('./utils'); 
const { authenticateWebhook, ipWhitelist } = require('./security'); // NODO 7

// --- CONFIGURACIÓN Y MIDDLEWARE ---
const PORT = process.env.PORT || 3000;
const ALERT_EMAIL = "elimfilters@gmail.com"; 

app.use(express.json()); // Middleware para parsear el body JSON

// --- DEFENSA CAPA 2: RATE LIMITING (Controla la velocidad del tráfico) ---
// Configuración de ejemplo: 100 peticiones en 15 minutos por IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    standardHeaders: true, 
    legacyHeaders: false,
    message: {
        error: "RATE_LIMIT_EXCEEDED",
        message: "Demasiadas solicitudes. Intente de nuevo en 15 minutos."
    }
});


// --- NODO 1: WEBHOOK ENDPOINT & NODO 6: RESPUESTA BLINDADA ---
app.post(
    '/webhook/filter-query', 
    ipWhitelist,         // [CAPA 3: Seguridad] Solo IPs permitidas (si aplica)
    authenticateWebhook, // [CAPA 1: Seguridad] Verifica la API Key
    apiLimiter,          // [CAPA 2: Anti-Scraping] Limita la velocidad
    async (req, res) => {
        const startTime = Date.now();
        const inputCode = req.body.code;
        let finalStatus = 500;
        
        try {
            // --- Nodos 2 al 5 se ejecutan dentro de filterProcessor.js ---
            const result = await processFilterCode(inputCode, req.body.options); 
            
            // Si el resultado interno es OK (incluye CACHED y NEW)
            if (result && result.results && result.results[0].ok) {
                finalStatus = 200;
                res.status(finalStatus).json(result);
            } else {
                // Captura fallos lógicos (INVALID_CODE del NODO 2/3)
                finalStatus = 400;
                res.status(finalStatus).json(result);
            }

        } catch (error) {
            // --- CAPTURA DE ERRORES CRÍTICOS (NODO 6 Blindaje) ---
            console.error(`[NODO 6] ERROR FATAL al procesar ${inputCode}:`, error);

            // 1. DISPARAR ALERTA (NODO 7)
            await sendCriticalAlert(
                ALERT_EMAIL, 
                `[ALERTA CRÍTICA] Fallo de Servidor/Datos para ${inputCode}`, 
                `Error: ${error.message}. Revisar logs en Railway y ErrorLog Sheet.`
            );
            
            // 2. RESPUESTA SEGURA Y GENÉRICA (Blindaje)
            finalStatus = 500;
            const safeResponse = error.safeErrorResponse || { 
                results: [{ 
                    error: "INTERNAL_SERVER_ERROR", 
                    message: "Error de servidor. El catálogo no pudo ser procesado temporalmente.", 
                    query_norm: inputCode || "N/A", 
                    ok: false 
                }] 
            };
            res.status(finalStatus).json(safeResponse);

        } finally {
            // --- REGISTRO DE ACTIVIDAD (NODO 7: Logging) ---
            // logWebhookActivity(req, finalStatus, startTime); 
            // Esto usa la respuesta real (result o safeResponse)
        }
    }
);

// --- INICIO DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`✅ Webhook activo en puerto ${PORT}`);
    console.log(`🔑 API Key requerida via 'x-api-key'`);
});

// Nota: Debes crear los archivos 'filterProcessor.js', 'security.js', y 'utils.js' 
// e instalar 'express-rate-limit'.
