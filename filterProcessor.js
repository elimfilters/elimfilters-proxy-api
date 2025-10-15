// filterProcessor.js (Lógica Interna - Limpieza)

// Importaciones
const { readFromCache, writeToMasterAndCache, logToErrorSheet } = require('./dataAccess'); // Ahora son funciones seguras
const { findExactHomologation } = require('./homologationDB');
const { getElimfiltersPrefix, determineDutyLevel, applyBaseCodeLogic } = require('./businessLogic');
const { buildFilterResponse } = require('./jsonBuilder'); 
// ... (Otras importaciones)

// NODO 2: VALIDACIÓN & CACHÉ CHECK
async function validateAndCheckCache(inputCode) {
    // ... (Lógica de normalización y validación de longitud)
    // ...
    
    // NODO 4.5 LECTURA: Intenta la Ruta Rápida (Ahora siempre devuelve null)
    const cachedData = await readFromCache(normalizedCode); 

    if (cachedData) {
        // ...
    }

    return { valid: true, status: "NEW", normalized: normalizedCode };
}


// LÓGICA DE PROCESAMIENTO CENTRAL (Nodos 2 al 5)
async function processFilterCode(inputCode, options = {}) {
    
    const validationResult = await validateAndCheckCache(inputCode);
    const normalized = validationResult.normalized;

    // ... (Manejo de errores 400 - INVALID_CODE)

    if (validationResult.status === "CACHED") {
        return buildFilterResponse(validationResult.cachedData); 
    }

    // NODO 3: BÚSQUEDA ESTRICTA
    const { found, rawData } = await findExactHomologation(normalized);
    // ... (Manejo de error 400 - NO ENCONTRADO)

    // NODO 4: CLASIFICACIÓN Y SKU
    // ... (Lógica de determinación HD/LD y generación de SKU)
    
    const processedData = {
        // ... (Datos procesados)
    };

    // NODO 4.5: PERSISTENCIA (Escritura - Ahora es una llamada segura que hace logging)
    await writeToMasterAndCache(processedData);

    // NODO 5: GENERACIÓN DE RESPUESTA JSON
    return buildFilterResponse(processedData); 
}

module.exports = { processFilterCode };
