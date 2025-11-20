// ============================================================================
// ELIMFILTERS — API SERVER v3.0
// Motor oficial de consulta: OEM, CROSS, SKU, multi-equivalencias.
// ============================================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// NUEVO MOTOR V3
const filterEngine = require("./src/core/filterEngine");
const homologationDB = require("./src/core/homologationDB");
const jsonBuilder = require("./src/utils/jsonBuilder");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ============================================================================
app.get("/", (req, res) => {
    res.send("ELIMFILTERS API v3.0 — Motor de homologación y búsqueda.");
});
// ============================================================================


// ============================================================================
// ENDPOINT PRINCIPAL DE BÚSQUEDA
// /api/v1/filters/search?code=xxxx
// ============================================================================
app.get("/api/v1/filters/search", async (req, res) => {
    try {
        const inputCode = req.query.code;

        if (!inputCode) {
            return res.status(400).json(
                jsonBuilder.buildErrorResponse({
                    error: "MISSING_CODE",
                    message: "Debe enviar el parámetro ?code=XXXXX",
                    ok: false
                })
            );
        }

        console.log(`🔍 Consulta recibida → ${inputCode}`);

        const result = await filterEngine.processCode(inputCode);

        return res.json(result);

    } catch (err) {
        console.error("❌ ERROR FATAL EN SERVER:", err);

        return res.status(500).json(
            jsonBuilder.buildErrorResponse({
                error: "SERVER_CRASH",
                message: "Error interno en el servidor.",
                details: err.message || "No details",
                ok: false
            })
        );
    }
});


// ============================================================================
// ENDPOINT — Auditoría de códigos desconocidos
// ============================================================================
app.get("/api/v1/homologation/unknown", (req, res) => {
    try {
        const list = homologationDB.loadMulti();

        return res.json({
            ok: true,
            total: list.length,
            data: list
        });

    } catch (err) {
        return res.status(500).json(
            jsonBuilder.buildErrorResponse({
                error: "HOMOLOGATION_READ_ERROR",
                message: "No se pudieron cargar los códigos desconocidos.",
                details: err.message
            })
        );
    }
});


// ============================================================================
// ACTIVAR SERVIDOR
// ============================================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 ELIMFILTERS API v3.0 funcionando en puerto ${PORT}`);
});
