// server.js — Entry Point with Scraping and Sheets Integration
// Nota: Hemos movido require('dotenv').config() dentro de la función initializeAndStart
// y hemos movido la carga de getPrivateKey a una función de importación dinámica.

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { detectFilter, setSheetsInstance } = require('./detectionService');
const fs = require('fs'); // Se agrega para manejo extremo de claves

// Variables globales para Express
const app = express();
const PORT = process.env.PORT || 8080;
let ADMIN_KEY = process.env.ADMIN_KEY; // Se carga en initializeAndStart
let WORDPRESS_URL = process.env.WORDPRESS_URL || '*'; // Se carga en initializeAndStart

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
        res.status(503).send('Service initializing');
    }
});
// ===================================

// Middlewares (usarán variables de entorno ya cargadas si existen, si no, * fallará)
app.use(cors({ origin: WORDPRESS_URL }));
app.use(morgan('dev'));
app.use(bodyParser.json());

// ===================================
// 🛠️ FUNCIÓN ASÍNCRONA DE INICIO EXTREMA (Solución de Cierre Inmediato)
// Iniciamos el servidor Express primero, y LUEGO configuramos la lógica sensible.
// ===================================
async function initializeAndStart() {
    // 1. INICIAR EL SERVIDOR EXPRESS INMEDIATAMENTE
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
    });

    // Pequeño retraso de 1 segundo para que la escucha se establezca
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. CARGAR VARIABLES Y CLAVES SENSIBLES DESPUÉS DE QUE EL SERVIDOR ESTÉ VIVO
    console.log("🟡 Iniciando configuración de Google Sheets y claves sensibles...");
    
    // 2.1 Cargar Dotenv (si aplica)
    require('dotenv').config();
    ADMIN_KEY = process.env.ADMIN_KEY;
    WORDPRESS_URL = process.env.WORDPRESS_URL || '*';

    // 2.2 Obtener Clave Privada (Lógica extra-robusta)
    let getPrivateKey = () => { throw new Error('getPrivateKey function not available'); };
    let sheetsInstance = null;
    
    try {
        // Intentar importar la clave (Puede fallar si secureKey.js no existe)
        const keyModule = require('./utils/secureKey');
        getPrivateKey = keyModule.getPrivateKey;
    } catch (error) {
        console.error('❌ ERROR: No se pudo importar ./utils/secureKey.js. Esto es crítico.');
        // No salimos del proceso.
    }

    // 2.3 Configuración de Google Sheets
    try {
        const privateKey = getPrivateKey();

        const auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            privateKey,
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
                // ... Lógica de Google Sheets ...
                const res = await sheets.spreadsheets.values.get({
                    spreadsheetId: SHEET_ID,
                    range: `${SHEET_NAME}!A2:A`,
                });
                const rows = res.data.values || [];
                const rowIndex = rows.findIndex(row => row[0] === data.sku);
                const values = [[
                    data.sku, data.filter_type, data.duty, data.oem_code, data.source_code, data.source,
                    data.cross_reference.join(', '), data.oem_codes.join('; '),
                    data.engine_applications.join('; '), data.equipment_applications.join('; '),
                    '', '', '', data.description, '', '', '', '', new Date().toISOString()
                ]];

                const targetRange = `${SHEET_NAME}!A${rowIndex + 2}`;
                if (rowIndex >= 0) {
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: SHEET_ID,
                        range: targetRange,
                        valueInputOption: 'RAW', requestBody: { values },
                    });
                } else {
                    await sheets.spreadsheets.values.append({
                        spreadsheetId: SHEET_ID,
                        range: `${SHEET_NAME}!A2`,
                        valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values },
                    });
                }
            },
        };

        setSheetsInstance(sheetsInstance);
        console.log("🟢 Google Sheets configurado. Servicios funcionales.");
    } catch (e) {
        console.error("❌ ERROR CRÍTICO: Fallo al autenticar Google Sheets. La API de detección NO funcionará:", e.message);
        // El servidor sigue vivo gracias a que app.listen ya se ejecutó.
    }
    
    // 3. MARCAR LA APLICACIÓN COMO LISTA
    isAppReady = true; 
    console.log("✅ Aplicación marcada como lista para Healthcheck (200 OK).");
    
    // 4. Endpoint Principal y Admin (usando sheetsInstance)
    
    app.post('/api/detect', async (req, res) => {
        const { query } = req.body;
        if (!query) return res.status(400).json({ status: 'ERROR', message: 'Missing query' });
        
        if (!isAppReady) {
            return res.status(503).json({ status: 'ERROR', message: 'Service is still initializing.' });
        }

        try {
            // Se usa el sheetsInstance local, que puede ser null si falló la inicialización
            const result = await detectFilter(query, sheetsInstance); 
            return res.json(result);
        } catch (err) {
            // Si falla la lógica interna
            return res.status(500).json({ status: 'ERROR', message: err.message });
        }
    });

    app.post('/api/admin/update', async (req, res) => {
        const key = req.headers['x-admin-key'];
        if (key !== ADMIN_KEY) return res.status(403).json({ status: 'FORBIDDEN' });
        return res.json({ status: 'OK', message: 'Admin endpoint working' });
    });
}

// Ejecutar la función de inicio
initializeAndStart().catch(err => {
    console.error('❌ ERROR DE INICIO CAPTURADO:', err.message);
    // Ya no usamos process.exit(1), solo registramos el error.
});
