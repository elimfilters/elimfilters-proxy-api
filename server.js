// server.js (Versión Completa y Blindada, lista para la certificación)

import express from 'express';
import cors from 'cors'; 

// Importar la lógica central y de seguridad con la sintaxis ES Modules
import { processFilterCode } from './filterProcessor.js'; 
import { authenticateWebhook } from './security.js'; // Asumiendo que security.js ya usa 'export'

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors()); 

// --- NODO 1: WEBHOOK ENDPOINT ---
app.post(
    '/webhook/filter-query', 
    authenticateWebhook, // NODO 6: AUTENTICACIÓN
    async (req, res) => {
        
        const inputCode = req.body.code || req.body.input_code; 
        
        if (!inputCode) {
             return res.status(400).json({ error: "CÓDIGO REQUERIDO", message: "Falta el campo 'code' en el cuerpo de la solicitud." });
        }
        
        try {
            // NODO 2 -> NODO 3 -> NODO 4: Lógica de procesamiento y SKU
            const finalResult = await processFilterCode(inputCode);
            
            // NODO 5: RESPUESTA DE ÉXITO
            res.status(200).json({ 
                ok: true,
                results: [finalResult] 
            });

        } catch (error) {
            
            // NODO 7: MANEJO DE ERRORES Y LOGGING
            const status = error.status || 500;
            const safeResponse = error.safeErrorResponse || {
                results: [{
                    error: "SERVER_ERROR", 
                    message: "Error interno del servidor. Contacte al administrador.", 
                    ok: false
                }]
            };
            
            // Aquí se llamaría a la función de logging (si estuviera activa)
            // logToErrorSheet(inputCode, error.message);
            
            res.status(status).json(safeResponse);
        }
    }
);

app.listen(PORT, () => {
    console.log(`✅ ELIMFILTERS API running on port ${PORT}`);
});
