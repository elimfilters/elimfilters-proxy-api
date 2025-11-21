// ============================================================================
// ELIMFILTERS — API SERVER v3.0
// Motor oficial de consulta: OEM, CROSS, SKU, multi-equivalencias.
// ============================================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Núcleo
const filterEngine = require("./src/core/filterEngine");
const homologationDB = require("./src/core/homologationDB");
const jsonBuilder = require("./src/utils/jsonBuilder");

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================================
// HOME
// ============================================================================
app.get("/", (req, res) => {
    res.send("ELIMFILTERS API v3.0 — Motor de homologación y búsqueda.");
});

// ============================================================================
// ENDPOINT PRINCIPAL DE BÚSQUEDA
// ============================================================================
app.get("/api/v1/filters/search", async (req, res) => {
    try {
        const code = req.query.code;

        if (!code) {
            return res.status(400).json(
                jsonBuilder.buildErrorResponse({
                    error: "MISSING_CODE",
                    message: "Debe enviar ?code=XXXX"
                })
            );
        }

        console.log("🔍 Consulta:", code);

        const result = await filterEngine.processCode(code);

        return res.json(result);

    } catch (err) {
        console.error("❌ SERVER CRASH:", err);
        return res.status(500).json(
            jsonBuilder.buildErrorResponse({
                error: "SERVER_CRASH",
                message: err.message
            })
        );
    }
});

// ============================================================================
// AUDITORÍA: MULTI-EQUIVALENCIAS
// ============================================================================
app.get("/api/v1/homologation/unknown", (req, res) => {
    try {
        const data = homologationDB.loadMulti();
        res.json({ ok: true, total: data.length, data });
    } catch (err) {
        res.status(500).json(
            jsonBuilder.buildErrorResponse({
                error: "HOMOLOGATION_READ_ERROR",
                message: err.message
            })
        );
    }
});

// ============================================================================
// SERVIDOR
// ============================================================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 ELIMFILTERS API v3.0 running on port ${PORT}`);
});
