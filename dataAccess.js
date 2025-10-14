// dataAccess.js (NODO 4.5: Persistencia en Google Sheets)

const { GoogleSpreadsheet } = require('google-spreadsheet');

// Importante: Reemplaza con el ID de tu URL
const SHEET_ID = '1ZYI5c0enkuvWAveu8HMaCUk1cek_VDrX8GtgKW7VP6U'; 

// Configuración de credenciales desde Railway ENV
const creds = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // La clave privada DEBE ser formateada correctamente desde Railway
    private_key: process.env.GOOGLE_PRIVATE_KEY ? 
                 process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : 
                 null,
};

const doc = new GoogleSpreadsheet(SHEET_ID);

/**
 * NODO 2: Lee la hoja CACHE para la Ruta Rápida.
 * @returns {object|null} Datos del SKU si está en caché.
 */
async function readFromCache(normalizedCode) {
    if (!creds.client_email || !creds.private_key) {
        console.error("Fallo de credenciales de Google Sheets. Revisar Railway ENV.");
        return null; 
    }
    
    try {
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo(); 
        
        const cacheSheet = doc.sheetsByTitle['CACHE'];
        if (!cacheSheet) throw new Error("Sheet 'CACHE' no encontrado.");
        
        // Simulación de búsqueda. Mejorar con una búsqueda más eficiente si la hoja crece.
        const rows = await cacheSheet.getRows();
        const cachedRow = rows.find(row => row.query_norm === normalizedCode);
        
        return cachedRow ? cachedRow.toObject() : null; // toObject para convertir a un objeto JS simple

    } catch (error) {
        console.error("[NODO 4.5] Error al leer la caché (Fallo silencioso):", error.message);
        return null; // Fallo silencioso, el flujo continúa a NODO 3
    }
}

/**
 * NODO 4.5: Escribe el resultado en MASTER y CACHE.
 */
async function writeToMasterAndCache(processedData) {
    if (!creds.client_email || !creds.private_key) return; 

    try {
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo(); 

        const masterSheet = doc.sheetsByTitle['MASTER'];
        const cacheSheet = doc.sheetsByTitle['CACHE'];
        
        if (!masterSheet || !cacheSheet) throw new Error("Sheets 'MASTER' o 'CACHE' no encontrados.");

        // Objeto que coincide con la estructura de tus 20+ columnas (JSON Builder)
        const rowData = {
            query_norm: processedData.queryNorm,
            SKU: processedData.sku,
            "OEM Codes": JSON.stringify(processedData.oemCodes), 
            "Cross Reference": JSON.stringify(processedData.crossReference),
            "Filter Type": processedData.filterType,
            "Duty": processedData.duty,
            "created_at": new Date().toISOString(),
            // ... Incluir el resto de las columnas de processedData.specs aquí
            // Ejemplo: "Height (mm)": processedData.specs["Height (mm)"] || null,
            ok: true
        };

        // 1. Escritura en MASTER (Persistencia de la Verdad)
        await masterSheet.addRow(rowData);
        
        // 2. Escritura en CACHE (Solo las claves para la lectura rápida)
        await cacheSheet.addRow({ query_norm: rowData.query_norm, SKU: rowData.SKU });
        
        console.log(`[NODO 4.5] Éxito: SKU ${rowData.SKU} guardado.`);

    } catch (error) {
        console.error("[NODO 4.5] ERROR CRÍTICO DE ESCRITURA (Revisar permisos):", error.message);
        // Nota: Un fallo aquí significa que el SKU no se cacheará, pero la respuesta HTTP ya fue enviada (un fallo en el futuro).
    }
}

/**
 * NODO 7: Escribe el error en ErrorLog.
 */
async function logToErrorSheet(code, error) {
    if (!creds.client_email || !creds.private_key) return;

    try {
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo(); 
        const errorSheet = doc.sheetsByTitle['ErrorLog'];

        await errorSheet.addRow({
            Timestamp: new Date().toISOString(),
            Query_Code: code,
            Error_Type: error.errorCode || '400_INVALID_CODE',
            Error_Message: error.message || JSON.stringify(error),
            Status_Code: error.status || 400,
        });

    } catch (logError) {
        console.error("[NODO 7] Fallo al escribir en ErrorLog (Ignorado).");
    }
}

module.exports = {
    readFromCache,
    writeToMasterAndCache,
    logToErrorSheet
};
