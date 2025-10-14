// filterProcessor.js (Orquestador Interno: Nodos 2, 3, 4, 4.5, 5)

// --- Importaciones de la Lógica y Datos ---
const { readFromCache, writeToMasterAndCache } = require('./dataAccess');
const { findExactHomologation } = require('./homologationDB');
const { getElimfiltersPrefix, determineDutyLevel, applyBaseCodeLogic } = require('./businessLogic');
const { buildFilterResponse } = require('./jsonBuilder'); 

// --- NODO 2: VALIDACIÓN & CACHÉ CHECK ---
async function validateAndCheckCache(inputCode) {
    let normalizedCode = String(inputCode || '').toUpperCase().trim().replace(/[\s\-/]/g, '');

    // 1. Fallo de formato (INVALID_CODE)
    if (normalizedCode.length < 4) {
        return { 
            valid: false, 
            error: "CÓDIGO INVÁLIDO. Por favor, ingrese un código válido OEM o Cross Reference para la búsqueda.", 
            normalized: normalizedCode 
        };
    }
    
    // NODO 4.5 LECTURA (Ruta Rápida)
    const cachedData = await readFromCache(normalizedCode); 

    if (cachedData) {
        console.log(`[NODO 2] Caché Hit para ${normalizedCode}.`);
        return { valid: true, status: "CACHED", normalized: normalizedCode, cachedData };
    }

    return { valid: true, status: "NEW", normalized: normalizedCode };
}


// --- LÓGICA DE PROCESAMIENTO CENTRAL (Nodos 2 al 5) ---
async function processFilterCode(inputCode, options = {}) {
    
    const validationResult = await validateAndCheckCache(inputCode);
    const normalized = validationResult.normalized;

    // A. Captura el Fallo de Formato del NODO 2
    if (!validationResult.valid) {
         // Lanza error 400 (INVALID_CODE) que server.js atrapará
        throw { 
            status: 400, 
            safeErrorResponse: { results: [{ error: "INVALID_CODE", message: validationResult.error, query_norm: normalized, ok: false }] } 
        };
    }

    // B. RUTA RÁPIDA (CACHED)
    if (validationResult.status === "CACHED") {
        return buildFilterResponse(validationResult.cachedData); 
    }

    // C. RUTA COMPLETA (NEW)
    
    // ============================================
    // NODO 3: BÚSQUEDA ESTRICTA
    // ============================================
    const { found, rawData } = await findExactHomologation(normalized);
    
    if (!found) {
        // Lanza error 400 (NO ENCONTRADO) que server.js atrapará
        throw { 
            status: 400, 
            safeErrorResponse: { results: [{ error: "INVALID_CODE", message: "CÓDIGO INVÁLIDO O NO ENCONTRADO. Por favor, ingrese el código completo y exacto...", query_norm: normalized, ok: false }] } 
        };
    }

    // ============================================
    // NODO 4: CLASIFICACIÓN Y GENERACIÓN DE SKU
    // ============================================
    
    const family = rawData.filter_family;
    // 1. Determinación de Duty (CRÍTICO)
    const duty = determineDutyLevel(family, rawData.specs, rawData.oem_codes, rawData.cross_reference); 
    
    // 2. Generación de Base Code (Regla Donaldson/FRAM)
    const baseCodeResult = applyBaseCodeLogic(duty, family, rawData.oem_codes, rawData.cross_reference);
    
    // 3. Generación Final de SKU
    const prefix = getElimfiltersPrefix(family);
    const finalSku = prefix + baseCodeResult.baseCode;

    // Compilar Datos Procesados
    const processedData = {
        queryNorm: normalized,
        sku: finalSku,
        duty: duty,
        filterType: family,
        mediaType: rawData.mediaType || 'STANDARD', // Asumimos un fallback si no está en DB
        oemCodes: rawData.oem_codes,
        crossReference: rawData.cross_reference,
        specs: rawData.specs,
        // ... (otros metadatos)
    };

    // ============================================
    // NODO 4.5: PERSISTENCIA (ESCRITURA)
    // ============================================
    await writeToMasterAndCache(processedData);

    // ============================================
    // NODO 5: GENERACIÓN DE RESPUESTA JSON
    // ============================================
    return buildFilterResponse(processedData); 
}

module.exports = { processFilterCode };
