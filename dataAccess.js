// dataAccess.js (Versión de Despliegue - Google Sheets Desactivado)

// No importamos GoogleSpreadsheet para evitar errores de inicialización.

/**
 * NODO 2: Lee la hoja CACHE para la Ruta Rápida.
 * @returns {object|null} Siempre devuelve null para forzar la Ruta Completa, 
 * ya que la caché está desactivada.
 */
async function readFromCache(normalizedCode) {
    console.warn("[NODO 4.5] ADVERTENCIA: LECTURA DE CACHÉ DESACTIVADA. Forzando Ruta Completa.");
    return null; 
}

/**
 * NODO 4.5: Intenta escribir el resultado. Se mantiene vacío para evitar fallos.
 */
async function writeToMasterAndCache(processedData) {
    console.warn(`[NODO 4.5] ADVERTENCIA: ESCRITURA DE SKU ${processedData.sku} DESACTIVADA. Solo para prueba.`);
    // En el futuro, aquí se re-implementaría la lógica de escritura.
}

/**
 * NODO 7: Intenta escribir el error en ErrorLog. Se mantiene vacío.
 */
async function logToErrorSheet(code, error) {
    console.error("[NODO 7] ADVERTENCIA: LOGGING DE ERRORES DESACTIVADO. Revisar consola de Railway.");
}

module.exports = {
    readFromCache,
    writeToMasterAndCache,
    logToErrorSheet
};
