// server.js (Versión Final con Sintaxis 'import')

import express from 'express';
import cors from 'cors';
import { processFilterCode } from './filterProcessor.js';
import { authenticateWebhook, ipWhitelist } from './security.js';
import { logWebhookActivity, sendCriticalAlert } from './utils.js';

const app = express();
const PORT = process.env.PORT || 3000;
const ALERT_EMAIL = "elimfilters@gmail.com";

// --- MIDDLEWARE ---
app.use(express.json());
app.use(cors({ origin: 'https://www.elimfilters.com' })); 

// --- NODO 1: WEBHOOK ENDPOINT (Blindado) ---
app.post(
    '/webhook/filter-query', 
    ipWhitelist,         
    authenticateWebhook, 
    // Rate Limiting debe ser importado y usado aquí si está instalado
    async (req, res) => {
        const startTime = Date.now();
        const inputCode = req.body.code;
        let finalStatus = 500;
        
        try {
            // Llama a la lógica central del catálogo
            const result = await processFilterCode(inputCode, req.body.options); 
            
            finalStatus = 200;
            res.status(finalStatus).json(result);

        } catch (error) {
            // NODO 6: Captura y maneja los errores
            
            if (error.status === 400) {
                // FALLO DE NEGOCIO (400)
                finalStatus = 400;
                res.status(finalStatus).json(error.safeErrorResponse);
            } else { 
                // FALLO CRÍTICO (500)
                await sendCriticalAlert(ALERT_EMAIL, `[CRÍTICO] Fallo de Servidor/Datos para ${inputCode}`, `Error: ${error.message}`);
                finalStatus = 500;
                const safeResponse = error.safeErrorResponse || { results: [{ error: "INTERNAL_SERVER_ERROR", message: "Error crítico de servidor.", ok: false }] };
                res.status(finalStatus).json(safeResponse);
            }

        } finally {
            // NODO 7: Logging
            logWebhookActivity(req, finalStatus, startTime);
        }
    }
);

app.listen(PORT, () => {
    console.log(`✅ ELIMFILTERS API running on port ${PORT}`);
});
