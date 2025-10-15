// server.js (Versión de Prueba Mínima y Segura)
const express = require('express'); 
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
