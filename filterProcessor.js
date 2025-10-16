// filterProcessor.js (Orquestador Interno - Corregido para 'import/export')

// --- Importaciones de la Lógica y Datos (Nótese la extensión .js) ---
import { readFromCache, writeToMasterAndCache } from './dataAccess.js';
import { findExactHomologation } from './homologationDB.js';
import { getElimfiltersPrefix, determineDutyLevel, applyBaseCodeLogic } from './businessLogic.js';
import { buildFilterResponse } from './jsonBuilder.js'; 

// --- NODO 2: VALIDACIÓN & CACHÉ CHECK ---
async function validateAndCheckCache(inputCode) {
    let normalizedCode = String(inputCode || '').toUpperCase().trim().replace(/[\s\-/]/g, '');

    // 1. Fallo de formato (INVALID_CODE)
    if (normalizedCode.length < 4) {
        return { valid: false, error: "CÓDIGO INVÁLIDO. Por favor, ingrese un código válido OEM o Cross Reference...", normalized: normalizedCode };
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
export async function processFilterCode(inputCode, options = {}) {
    
    const validationResult = await validateAndCheckCache(inputCode);
    const normalized = validationResult.normalized;

    // A. Captura el Fallo de Formato del NODO 2
    if (!validationResult.valid) {
         // Lanza un error 400 que es atrapado en server.js
        throw { status: 400, safeErrorResponse: { results: [{ error: "INVALID_CODE", message: validationResult.error, query_norm: normalized, ok: false }] } };
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
        // Lanza un error 400 (NO ENCONTRADO) que server.js atrapará
        throw { 
            status: 400, 
            safeErrorResponse: { results: [{ error: "INVALID_CODE", message: "CÓDIGO INVÁLIDO O NO ENCONTRADO...", query_norm: normalized, ok: false }] } 
        };
    }

    // ============================================
    // NODO 4: CLASIFICACIÓN Y GENERACIÓN DE SKU
    // ============================================
    
    const family = rawData.filter_family;
    const duty = rawData.duty_level || determineDutyLevel(family, rawData.specs, rawData.oem_codes, rawData.cross_reference); 
    
    // Si la data del NODO 3 ya tiene la prioridad, usarla; si no, usar la lógica
    const baseCodeTarget = rawData.priority_reference || applyBaseCodeLogic(duty, family, rawData.oem_codes, rawData.cross_reference);
    
    const prefix = getElimfiltersPrefix(family);
    
    // Extraer base code de la referencia target (que es un string de código)
    const numericCode = baseCodeTarget.replace(/[^0-9]/g, '');
    const baseCode = numericCode.slice(-4);
    
    const finalSku = prefix + baseCode;

    // Compilar Datos Procesados
    const processedData = {
        queryNorm: normalized,
        sku: finalSku,
        duty: duty,
        filterType: family,
        // ... (resto de datos para el NODO 5)
    };

    // NODO 4.5: PERSISTENCIA (ESCRITURA)
    await writeToMasterAndCache(processedData);

    // NODO 5: GENERACIÓN DE RESPUESTA JSON
    return buildFilterResponse(processedData); 
}
