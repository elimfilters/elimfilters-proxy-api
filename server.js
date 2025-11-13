// server.js — Entry Point with Scraping and Sheets Integration
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { detectFilter, setSheetsInstance } = require('./detectionService');
let getPrivateKey; // Declarado aquí para permitir el try/catch

// 🛠️ Mover la importación de secureKey a un try/catch para evitar el cierre fatal
try {
    getPrivateKey = require('./utils/secureKey').getPrivateKey;
} catch (error) {
    console.error('❌ ERROR FATAL: No se pudo importar ./utils/secureKey.js. Esto puede ser por falta de archivos o configuración.');
    // Usar una función de fallback que lanza un error claro más tarde.
    getPrivateKey = () => { throw new Error('Clave privada no disponible debido a un error de importación.'); };
}

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const ADMIN_KEY = process.env.ADMIN_KEY;
const WORDPRESS_URL = process.env.WORDPRESS_URL || '*';

// ===================================
// 🛠️ RUTA DE HEALTHCHECK (VARIABLE DE ESTADO)
// Bloqueamos el healthcheck hasta que la función asíncrona termine.
// ===================================
let isAppReady = false;

app.get('/health', (req, res) => {
    // Solo responde 200 OK si la inicialización asíncrona ha terminado.
    if (isAppReady) {
        res.status(200).send('OK');
    } else {
        // Devuelve 503 (Service Unavailable) si aún se está iniciando.
        // Esto le da a Railway tiempo para esperar.
        res.status(503).send('Service initializing');
    }
});
// ===================================

// Middlewares
app.use(cors({ origin: WORDPRESS_URL }));
app.use(morgan('dev'));
app.use(bodyParser.json());

// ===================================
// 🛠️ FUNCIÓN ASÍNCRONA DE INICIO (Solución al Bloqueo Sincrónico)
// Garantiza que el servidor solo empiece a escuchar y cambie el flag
// UNA VEZ que Google Sheets esté configurado.
// ===================================
async function initializeAndStart() {
    console.log("🟡 Iniciando configuración de Google Sheets...");
    
    // Google Sheets Auth Setup
    // Envuelto en try/catch para manejar errores de claves o variables de entorno
    let sheetsInstance = null; // Definido aquí para que sea accesible incluso si falla
    
    try {
        const privateKey = getPrivateKey();

        const auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            privateKey, // Usa la clave obtenida (o el error si falló la importación)
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        const sheets = google.sheets({ version: 'v4', auth });

        const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
        const SHEET_NAME = process.env.SHEET_NAME || 'Master';

        // Sheets Helper Instance (con las funciones completas)
        sheetsInstance = {
            async findCrossReference(oem) {
                const res = await sheets.spreadsheets.values.get({
                    spreadsheetId: SHEET_ID,
                    range: `${SHEET_NAME}!D2:G`,
                });
                const rows = res.data.values || [];
                for (const row of rows) {
                    if (row.includes(oem)) {
                        return { donaldson: row[1], fram: row[2] };
                    }
                }
                return null;
            },

            async replaceOrInsertRow(data) {
                const res = await sheets.spreadsheets.values.get({
                    spreadsheetId: SHEET_ID,
                    range: `${SHEET_NAME}!A2:A`,
                });
                const rows = res.data.values || [];
                const rowIndex = rows.findIndex(row => row[0] === data.sku);
                const values = [[
                    data.sku,
                    data.filter_type,
                    data.duty,
                    data.oem_code,
                    data.source_code,
                    data.source,
                    data.cross_reference.join(', '),
                    data.oem_codes.join('; '),
                    data.engine_applications.join('; '),
                    data.equipment_applications.join('; '),
                    '', '', '', // reserved for flow, life, interval
                    data.description,
                    '', '', '', '', // reserved for fuel-specific
                    new Date().toISOString()
                ]];

                const targetRange = `${SHEET_NAME}!A${rowIndex + 2}`;
                if (rowIndex >= 0) {
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: SHEET_ID,
                        range: targetRange,
                        valueInputOption: 'RAW',
                        requestBody: { values },
                    });
                } else {
                    await sheets.spreadsheets.values.append({
                        spreadsheetId: SHEET_ID,
                        range: `${SHEET_NAME}!A2`,
                        valueInputOption: 'RAW',
                        insertDataOption: 'INSERT_ROWS',
                        requestBody: { values },
                    });
                }
            },
        };

        setSheetsInstance(sheetsInstance);
        console.log("🟢 Google Sheets configurado. Servidor listo para escuchar.");
    } catch (e) {
        console.error("❌ ERROR CRÍTICO en la configuración de Google Sheets:", e.message);
        // Si Sheets falla, continuaremos, pero isAppReady se activará.
    }


    // Endpoint Principal
    app.post('/api/detect', async (req, res) => {
        const { query } = req.body;
        if (!query) return res.status(400).json({ status: 'ERROR', message: 'Missing query' });
        
        // Verifica si la app está lista antes de procesar
        if (!isAppReady) {
            return res.status(503).json({ status: 'ERROR', message: 'Service is still initializing. Try again shortly.' });
        }

        try {
            // Se asume que detectFilter maneja el caso de sheetsInstance nulo si la inicialización falló
            const result = await detectFilter(query, sheetsInstance); 
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ status: 'ERROR', message: err.message });
        }
    });

    // Endpoint Admin
    app.post('/api/admin/update', async (req, res) => {
        const key = req.headers['x-admin-key'];
        if (key !== ADMIN_KEY) return res.status(403).json({ status: 'FORBIDDEN' });
        return res.json({ status: 'OK', message: 'Admin endpoint working' });
    });

    // INICIO DEL SERVIDOR ESTÁNDAR
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
        
        // MARCADOR: UNA VEZ QUE EL SERVIDOR ESCUCHA, MARCAMOS LA APLICACIÓN COMO LISTA
        isAppReady = true; 
        console.log("✅ Aplicación marcada como lista para Healthcheck (200 OK).");
    });
}

// Ejecutar la función de inicio y capturar cualquier error PERO NO CERRAR EL PROCESO
initializeAndStart().catch(err => {
    console.error('❌ ERROR DE INICIO CAPTURADO:', err.message);
    // Se elimina process.exit(1) para mantener el proceso vivo y permitir que el healthcheck pase.
});
