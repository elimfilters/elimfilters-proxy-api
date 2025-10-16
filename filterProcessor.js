// filterProcessor.js (Orquestador Interno)

import { readFromCache, writeToMasterAndCache } from './dataAccess.js';
import { findExactHomologation } from './homologationDB.js';
import { getElimfiltersPrefix, determineDutyLevel, applyBaseCodeLogic } from './businessLogic.js';
import { buildFilterResponse } from './jsonBuilder.js'; 

// NODO 2: VALIDACIÓN & CACHÉ CHECK (Simplificado para el arranque)
async function validateAndCheckCache(inputCode) {
    let normalizedCode = String(inputCode || '').toUpperCase().trim().replace(/[\s\-/]/g, '');

    if (normalizedCode.length < 4) {
        return { valid: false, error: "CÓDIGO INVÁLIDO. Por favor, ingrese un código válido OEM o Cross Reference...", normalized: normalizedCode };
    }
    
    // NODO 4.5 LECTURA
    const cachedData = await readFromCache(normalizedCode); 

    if (cachedData) {
        return { valid: true, status: "CACHED", normalized: normalizedCode, cachedData };
    }

    return { valid: true, status: "NEW", normalized: normalizedCode };
}


// LÓGICA DE PROCESAMIENTO CENTRAL
export async function processFilterCode(inputCode, options = {}) {
    
    const validationResult = await validateAndCheckCache(inputCode);
    const normalized = validationResult.normalized;

    if (!validationResult.valid) {
        throw { status: 400, safeErrorResponse: { results: [{ error: "INVALID_CODE", message: validationResult.error, query_norm: normalized, ok: false }] } };
    }

    if (validationResult.status === "CACHED") {
        return buildFilterResponse(validationResult.cachedData); 
    }

    // NODO 3: BÚSQUEDA ESTRICTA
    const { found, rawData } = await findExactHomologation(normalized);
    
    if (!found) {
        throw { status: 400, safeErrorResponse: { results: [{ error: "INVALID_CODE", message: "CÓDIGO INVÁLIDO O NO ENCONTRADO...", query_norm: normalized, ok: false }] } };
    }

    // NODO 4: CLASIFICACIÓN Y SKU
    const family = rawData.filter_family;
    const duty = determineDutyLevel(family, rawData.specs, rawData.oem_codes, rawData.cross_reference); 
    
    // Si la lógica HD/LD no tiene certeza, lanza un error 500
    if (duty === 'UNKNOWN') {
        throw { errorCode: "DATA_UNCERTAINTY", message: "Clasificación Duty (HD/LD) falló por ambigüedad.", status: 500 };
    }
    
    const baseCodeResult = applyBaseCodeLogic(duty, family, rawData.oem_codes, rawData.cross_reference);
    const prefix = getElimfiltersPrefix(family);
    const finalSku = prefix + baseCodeResult.baseCode;

    const processedData = {
        queryNorm: normalized,
        sku: finalSku,
        duty: duty,
        filterType: family,
        // ... (resto de datos)
    };

    // NODO 4.5: PERSISTENCIA (Escritura segura)
    await writeToMasterAndCache(processedData);

    // NODO 5: GENERACIÓN DE RESPUESTA JSON
    return buildFilterResponse(processedData); 
}
