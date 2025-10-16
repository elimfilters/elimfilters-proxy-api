// dataAccess.js (Modo Seguro para Arranque)

export async function readFromCache(normalizedCode) {
    console.warn("[NODO 4.5] ADVERTENCIA: LECTURA DE CACHÉ DESACTIVADA. Forzando Ruta Completa.");
    return null; 
}

export async function writeToMasterAndCache(processedData) {
    console.warn(`[NODO 4.5] ADVERTENCIA: ESCRITURA DE SKU ${processedData.sku} DESACTIVADA.`);
}

export async function logToErrorSheet(code, error) {
    console.error("[NODO 7] ADVERTENCIA: LOGGING DE ERRORES DESACTIVADO.");
}
