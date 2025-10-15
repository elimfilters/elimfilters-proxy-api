// server.js (Versión de Prueba Mínima y Segura con SINTAXIS 'import')

import express from 'express'; 
import cors from 'cors'; // Asumimos que cors está instalado

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors()); 

// Endpoint de prueba que debe funcionar
app.get("/", (req, res) => {
    res.status(200).json({ 
        message: "ELIMFILTERS API - Testing Mode",
        status: "ACTIVE",
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`✅ TEST PROXY running on port ${PORT}`);
});
