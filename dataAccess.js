// dataAccess.js - v3.0.0 (PRODUCTION READY)
// Gestión de consultas a la Base de Datos Maestra (Homologación)

const axios = require('axios');

const GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_URL;  
const GOOGLE_SHEET_API_KEY = process.env.GOOGLE_SHEET_API_KEY;

async function queryMasterDatabase(normalizedCode) {
    console.log(`[DB] Consultando MASTER DB por: ${normalizedCode}`);

    try {
        const url = `${GOOGLE_SHEET_URL}?key=${GOOGLE_SHEET_API_KEY}`;

        const response = await axios.get(url, { timeout: 5000 });

        if (!response.data || !response.data.values) {
            console.log("[DB] ✗ Respuesta vacía de Sheets");
            return null;
        }

        const rows = response.data.values;

        // Encabezados
        const headers = rows[0];
        const dataRows = rows.slice(1);

        // Buscar coincidencia
        const match = dataRows.find(row => {
            const obj = toObject(headers, row);

            return (
                obj.original_code?.toUpperCase() === normalizedCode ||
                obj.cross_reference?.toUpperCase().includes(normalizedCode) ||
                obj.oem_codes?.toUpperCase().includes(normalizedCode)
            );
        });

        if (!match) {
            console.log(`[DB] ✗ No match en la hoja de homologación`);
            return null;
        }

        const result = toObject(headers, match);

        console.log(`[DB] ✓ MATCH: ${result.original_code} → FAMILY ${result.filter_family}`);

        return {
            source: "MASTER_DB",
            rawData: result
        };

    } catch (err) {
        console.error("[DB ERROR] Error consultando Google Sheets:", err.message);
        return null;
    }
}

// Convierte array en objeto con headers
function toObject(headers, row) {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] || "");
    return obj;
}

module.exports = {
    queryMasterDatabase
};
