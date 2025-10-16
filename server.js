// server.js (Versión Mínima de Arranque y Prueba)

import express from 'express';
import cors from 'cors'; 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors()); 

// --- NODO 1: WEBHOOK ENDPOINT ---
app.post(
    '/webhook/filter-query', 
    // SE ELIMINAN LAS LLAMADAS A SEGURIDAD Y UTILIDADES AQUÍ
    async (req, res) => {
        
        // Simplemente respondemos OK para ver si el servidor arranca
        res.status(200).json({
            message: "Server is ACTIVE and ready to integrate logic.",
            received_code: req.body.code,
            status: "OK_TEST"
        });
    }
);

app.listen(PORT, () => {
    console.log(`✅ ELIMFILTERS API running on port ${PORT}`);
});
