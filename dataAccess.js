// dataAccess.js

// Eliminar require('google-spreadsheet') si está comentado.

export async function readFromCache(normalizedCode) {
    // ... (código que devuelve null si no está activo)
    return null; 
}

export async function writeToMasterAndCache(processedData) {
    // ... (código vacío para evitar errores)
}

export async function logToErrorSheet(code, error) {
    // ... (código vacío)
}
