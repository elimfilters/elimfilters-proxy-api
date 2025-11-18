// server.js – ELIMFILTERS PROXY API – v4.0.0
// Servidor Oficial de la API ELIMFILTERS
// Optimizado para Railway, WordPress, n8n y ChipMaster

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');

const filterProcessor = require('./filterProcessor');
const jsonBuilder = require('./jsonBuilder');
const homologationDB = require('./homologationDB');
const googleSheetsConnector = require('./googleSheetsConnector');

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================================================
// 1. Middlewares de seguridad y performance
// ============================================================================
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(compression());

// ============================================================================
// 2. Health Check (para Railway y Monitores)
// ============================================================================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: "OK",
        service: "ELIMFILTERS-PROXY-API",
        timestamp: new Date().toISOString(),
        version: "4.0.0"
    });
});

// ============================================================================
// 3. Endpoint principal: Buscar filtros (WordPress, móvil, web, Telegram, etc.)
// ============================================================================
app.post('/api/v1/filters/search', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({
            ok: false,
            error: "MISSING_CODE",
            message: "Debe enviar un código OEM/Cross Reference."
        });
    }

    try {
        const response = await filterProcessor.processFilterCode(code);

        return res.status(200).json({
            ok: true,
            results: [response]
        });

    } catch (err) {
        console.error('[ERROR /search]', err);

        return res.status(err.status || 500).json(
            err.safeErrorResponse || {
                ok: false,
                error: "UNKNOWN_ERROR",
                message: "Error procesando la solicitud."
            }
        );
    }
});

// ============================================================================
// 4. Endpoint para recargar BD desde Sheets manualmente (administración)
// ============================================================================
app.get('/api/v1/database/reload', async (req, res) => {
    try {
        const reloaded = await homologationDB.reloadDatabase();
        res.json({
            ok: true,
            updated: reloaded,
            message: "La Base de Datos de homologación fue recargada exitosamente."
        });
    } catch (err) {
        console.error('[ERROR /database/reload]', err);
        res.status(500).json({
            ok: false,
            error: "DB_RELOAD_FAILED",
            message: "No se pudo recargar la base de datos."
        });
    }
});

// ============================================================================
// 5. Endpoint de diagnóstico técnico (NO EXPONE reglas ni lógica interna)
// ============================================================================
app.get('/api/v1/system/info', (req, res) => {
    res.status(200).json({
        service: "ELIMFILTERS-PROXY-API",
        engine: "FilterEngine v4.0.0",
        processor: "FilterProcessor v3.0.0",
        database: "Google Sheets (homologationDB)",
        protections: "rulesProtection v2.2.4",
        server_time: new Date().toISOString()
    });
});

// ============================================================================
// 6. HOME PAGE
// ============================================================================
app.get('/', (req, res) => {
    res.send(`
        <h2>ELIMFILTERS Proxy API – v4.0.0</h2>
        <p>Status: OK</p>
        <p>Use /api/v1/filters/search para consultas.</p>
        <code>POST { "code": "LF3620" }</code>
    `);
});

// ============================================================================
// 7. Iniciar servidor
// ============================================================================
app.listen(PORT, () => {
    console.log(`🚀 ELIMFILTERS API running on port ${PORT}`);
});
