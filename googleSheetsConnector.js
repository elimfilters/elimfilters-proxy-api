// googleSheetsConnector.js - Conexión a Google Sheets
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1ZYI5c0enkuvWAveu8HMaCUk1cek_VDrX8GtgKW7VP6U';
const SHEET_NAME = 'Master';

let authClient = null;
let sheetsAPI = null;

/**
 * Inicializar autenticación con Google Sheets
 */
async function initializeAuth() {
    if (authClient) return authClient;

    try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');

        if (!credentials.type) {
            throw new Error('GOOGLE_CREDENTIALS no configuradas correctamente');
        }

        authClient = await google.auth.getClient({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });

        sheetsAPI = google.sheets({ version: 'v4', auth: authClient });
        console.log('[SHEETS] ✓ Autenticación inicializada');
        return authClient;

    } catch (error) {
        console.error('[SHEETS] ✗ Error inicializando autenticación:', error.message);
        throw error;
    }
}

/**
 * Leer todos los datos del Sheet
 */
async function readAllData() {
    try {
        await initializeAuth();

        const response = await sheetsAPI.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_NAME}!A1:Z1000` // Lee hasta 1000 filas
        });

        const rows = response.data.values || [];
        if (rows.length === 0) {
            console.warn('[SHEETS] ⚠ No hay datos en el Sheet');
            return [];
        }

        // Primera fila son los headers
        const headers = rows[0];
        const data = rows.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index] || '';
            });
            return obj;
        });

        console.log(`[SHEETS] ✓ Leídas ${data.length} filas`);
        return data;

    } catch (error) {
        console.error('[SHEETS] ✗ Error leyendo datos:', error.message);
        throw error;
    }
}

/**
 * Buscar un filtro por SKU
 */
async function findFilterBySku(sku) {
    try {
        const data = await readAllData();
        
        const filter = data.find(row => 
            row.SKU && row.SKU.toUpperCase() === sku.toUpperCase()
        );

        if (filter) {
            console.log(`[SHEETS] ✓ Filtro encontrado para SKU: ${sku}`);
            return filter;
        }

        console.log(`[SHEETS] ✗ Filtro no encontrado para SKU: ${sku}`);
        return null;

    } catch (error) {
        console.error('[SHEETS] ✗ Error buscando filtro:', error.message);
        throw error;
    }
}

/**
 * Buscar un filtro por OEM Code o Cross Reference
 */
async function findFilterByReference(code) {
    try {
        const data = await readAllData();
        
        const filter = data.find(row =>
            (row['OEM Codes'] && row['OEM Codes'].includes(code)) ||
            (row['Cross Reference'] && row['Cross Reference'].includes(code))
        );

        if (filter) {
            console.log(`[SHEETS] ✓ Filtro encontrado para código: ${code}`);
            return filter;
        }

        console.log(`[SHEETS] ✗ Filtro no encontrado para código: ${code}`);
        return null;

    } catch (error) {
        console.error('[SHEETS] ✗ Error buscando por referencia:', error.message);
        throw error;
    }
}

/**
 * Convertir fila del Sheet a formato esperado por API
 */
function formatFilterData(sheetRow) {
    return {
        query_norm: sheetRow['query_norm'] || '',
        SKU: sheetRow['SKU'] || '',
        OEM_Codes: sheetRow['OEM Codes'] || '',
        Cross_Reference: sheetRow['Cross Reference'] || '',
        Filter_Type: sheetRow['Filter Type'] || '',
        Media_Type: sheetRow['Media Type'] || '',
        Subtype: sheetRow['Subtype'] || '',
        Engine_Applications: sheetRow['Engine Applications'] || '',
        Equipment_Applications: sheetRow['Equipment Applications'] || '',
        Height_mm: parseFloat(sheetRow['Height (mm)']) || 0,
        Outer_Diameter_mm: parseFloat(sheetRow['Outer Diameter (mm)']) || 0,
        Thread_Size: sheetRow['Thread Size'] || '',
        Gasket_OD_mm: parseFloat(sheetRow['Gasket OD (mm)']) || 0,
        Gasket_ID_mm: parseFloat(sheetRow['Gasket ID (mm)']) || 0,
        Bypass_Valve_PSI: parseFloat(sheetRow['Bypass Valve (PSI)']) || 0,
        Micron_Rating: sheetRow['Micron Rating'] || '',
        Duty: sheetRow['Duty'] || '',
        ISO_Main_Efficiency: sheetRow['ISO Main Efficiency'] || '',
        ISO_Test_Method: sheetRow['ISO Test Method'] || '',
        Beta_200: sheetRow['Beta 200'] || '',
        Hydrostatic_Burst_Minimum_psi: parseFloat(sheetRow['Hydrostatic Burst Minimum (psi)']) || 0,
        Dirt_Capacity_g: parseFloat(sheetRow['Dirt Capacity (g)']) || 0,
        Rated_Flow: sheetRow['Rated Flow (CFM or m3/min)'] || '',
        Panel_Width_mm: parseFloat(sheetRow['Panel Width (mm)']) || 0,
        Panel_Depth_mm: parseFloat(sheetRow['Panel Depth (mm)']) || 0,
        created_at: sheetRow['created_at'] || new Date().toISOString(),
        ok: true
    };
}

module.exports = {
    initializeAuth,
    readAllData,
    findFilterBySku,
    findFilterByReference,
    formatFilterData
};
