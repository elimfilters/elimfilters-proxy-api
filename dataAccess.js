// dataAccess.js

// COMENTAR/IGNORAR TODAS las funciones que intentan usar credenciales de Google
// Dejamos las funciones vacías para que el flujo no se rompa:

async function readFromCache(normalizedCode) {
    console.warn("CACHE/DB NO CONECTADA. BUSCANDO EN MEMORIA DE PRUEBA.");
    // Devolvemos null para forzar la Ruta Completa
    return null; 
}

async function writeToMasterAndCache(processedData) {
    console.warn("ADVERTENCIA: ESCRITURA EN MASTER/CACHE DESACTIVADA. SOLO PARA PRUEBA.");
}

async function logToErrorSheet(code, error) {
    console.error("LOGGING EN GOOGLE SHEETS DESACTIVADO.");
}

module.exports = {
    readFromCache,
    writeToMasterAndCache,
    logToErrorSheet
};
