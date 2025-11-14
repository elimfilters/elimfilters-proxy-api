// server.js — Entry Point with Scraping and Sheets Integration
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { detectFilter, setSheetsInstance } = require('./detectionService');
const fs = require('fs'); 

// Mover la importación de getPrivateKey a un try/catch para evitar el cierre fatal
let getPrivateKey; 
try {
    getPrivateKey = require('./utils/secureKey').getPrivateKey;
} catch (error) {
    console.error('❌ ERROR FATAL: No se pudo importar ./utils/secureKey.js. Esto puede ser por falta de archivos o configuración.');
    getPrivateKey = () => { throw new Error('Clave privada no disponible debido a un error de importación.'); };
}

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const ADMIN_KEY = process.env.ADMIN_KEY;
const WORDPRESS_URL = process.env.WORDPRESS_URL || '*';

// Middlewares
app.use(cors({ origin: WORDPRESS_URL }));
app.use(morgan('dev'));
app.use(bodyParser.json());

// ===================================
// 🛠️ RUTA DE HEALTHCHECK (Estándar: 200 OK)
// Se mantiene la versión simple para que Railway no se confunda.
// ===================================
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});
// ===================================


// Inicialización de Google Sheets (Función asíncrona para contener la lógica)
async function setupSheets() {
    console.log("🟡 Iniciando configuración de Google Sheets...");
    
    try {
        const privateKey = getPrivateKey();
        if (privateKey.includes('Clave privada no disponible')) {
             throw new Error("La clave privada no se cargó correctamente.");
        }

        const auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            privateKey, 
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        const sheets = google.sheets({ version: 'v4', auth });

        const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
        const SHEET_NAME = process.env.SHEET_NAME || 'Master';

        // Sheets Helper Instance
        const sheetsInstance = {
            async findCrossReference(oem) {
                 const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!D2:G` });
                 const rows = res.data.values || [];
                 for (const row of rows) {
                     if (row.includes(oem)) { return { donaldson: row[1], fram: row[2] }; }
                 }
                 return null;
            },

            async replaceOrInsertRow(data) {
                 const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A2:A` });
                 const rows = res.data.values || [];
                 const rowIndex = rows.findIndex(row => row[0] === data.sku);
                 const values = [[data.sku, data.filter_type, data.duty, data.oem_code, data.source_code, data.source,
                     data.cross_reference.join(', '), data.oem_codes.join('; '), data.engine_applications.join('; '),
                     data.equipment_applications.join('; '), '', '', '', data.description, '', '', '', '', new Date().toISOString()]];

                 const targetRange = `${SHEET_NAME}!A${rowIndex + 2}`;
                 if (rowIndex >= 0) {
                     await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: targetRange, valueInputOption: 'RAW', requestBody: { values } });
                 } else {
                     await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A2`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values } });
                 }
            },
        };
        
        setSheetsInstance(sheetsInstance);
        console.log("🟢 Google Sheets configurado. Servicios funcionales.");
        return sheetsInstance;

    } catch (e) {
        console.error("❌ ERROR CRÍTICO: Fallo al autenticar Google Sheets. La API de detección NO funcionará:", e.message);
        return null;
    }
}

// ===================================
// 🛠️ INICIO FINAL: Usar setTimeout como única protección.
// Si esto falla, el problema es 100% de la plataforma.
// ===================================

const startApp = async () => {
    // 1. Configurar Sheets (esto puede tardar)
    const sheetsInstance = await setupSheets();

    // 2. Definir Endpoints (usando el sheetsInstance, que puede ser null si falló)
    app.post('/api/detect', async (req, res) => {
        const { query } = req.body;
        if (!query) return res.status(400).json({ status: 'ERROR', message: 'Missing query' });
        
        if (!sheetsInstance) {
             return res.status(503).json({ status: 'ERROR', message: 'Service is initializing or Sheets is unavailable.' });
        }

        try {
            const result = await detectFilter(query, sheetsInstance); 
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ status: 'ERROR', message: err.message });
        }
    });

    app.post('/api/admin/update', async (req, res) => {
        const key = req.headers['x-admin-key'];
        if (key !== ADMIN_KEY) return res.status(403).json({ status: 'FORBIDDEN' });
        return res.json({ status: 'OK', message: 'Admin endpoint working' });
    });

    // 3. Iniciar el servidor Express con un retraso de 4 segundos.
    setTimeout(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Server listening on 0.0.0.0:${PORT} after 4s delay.`);
        });
    }, 4000); // Retraso de 4 segundos
}

startApp().catch(err => {
    console.error('❌ ERROR FATAL EN startApp:', err.message);
    // No usamos process.exit(1), dejamos que el contenedor viva
});
