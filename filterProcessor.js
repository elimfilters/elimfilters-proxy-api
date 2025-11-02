// filterProcessor.js (Orquestador Interno - v3.0.0 SIN OpenAI)
const dataAccess = require('./dataAccess');
const homologationDB = require('./homologationDB');
const businessLogic = require('./businessLogic');
const jsonBuilder = require('./jsonBuilder');

/**
 * NODO 2: Validación y Normalización de entrada
 */
async function validateAndCheckCache(inputCode) {
    if (!inputCode) {
        throw {
            status: 400,
            safeErrorResponse: {
                results: [{
                    error: "EMPTY_CODE",
                    message: "Código requerido. Por favor, ingrese un código válido OEM o Cross Reference.",
                    ok: false
                }]
            }
        };
    }

    const normalized = (inputCode || '').trim().toUpperCase();

    if (!normalized) {
        throw {
            status: 400,
            safeErrorResponse: {
                results: [{
                    error: "INVALID_CODE",
                    message: "El código ingresado no es válido después de la normalización.",
                    ok: false
                }]
            }
        };
    }

    console.log(`[NODO 2] Código normalizado: ${normalized}`);
    return { normalized };
}

/**
 * NODO 3: Consulta a base de datos maestra
 */
async function queryMasterDatabase(normalized) {
    console.log(`[NODO 3] Consultando base de datos maestra para: ${normalized}`);
    
    const matchResult = await dataAccess.queryMasterDatabase(normalized);

    if (!matchResult || !matchResult.rawData) {
        console.log(`[NODO 3] ✗ Código no encontrado en base de datos maestra`);
        throw {
            status: 404,
            safeErrorResponse: {
                results: [{
                    query_norm: normalized,
                    error: "NOT_FOUND",
                    message: `El código '${normalized}' no se encontró en nuestra base de datos.`,
                    ok: false
                }]
            }
        };
    }

    console.log(`[NODO 3] ✓ Código encontrado en base de datos maestra`);
    return matchResult;
}

/**
 * NODO 4: Generación de SKU
 */
function generateFinalSku(rawData, normalized) {
    console.log(`[NODO 4] Generando SKU para: ${normalized}`);
    
    const skuGeneration = businessLogic.generateSKU({
        family: rawData.filter_family,
        duty: rawData.duty_level,
        oem_code: rawData.priority_reference || normalized
    });

    console.log(`[NODO 4] ✓ SKU generado: ${skuGeneration.sku}`);
    return skuGeneration;
}

/**
 * NODO 5: Construcción de respuesta
 */
function buildResponse(dataSource, rawData, skuGeneration, normalized) {
    console.log(`[NODO 5] Construyendo respuesta final`);
    
    const response = jsonBuilder.buildStandardResponse({
        queryNorm: normalized,
        sku: skuGeneration.sku,
        duty: skuGeneration.duty,
        filterType: rawData.filter_family,
        family: rawData.filter_family,
        specs: rawData.specs || {},
        oemCodes: Array.isArray(rawData.oem_codes) ? rawData.oem_codes : [rawData.priority_reference || normalized],
        crossReference: rawData.cross_reference || [],
        baseCode: skuGeneration.baseCode,
        prefix: skuGeneration.prefix,
        source: dataSource,
        confidence: dataSource === 'MASTER_DB' ? 'HIGH' : 'MEDIUM'
    });

    console.log(`[NODO 5] ✓ Respuesta construida exitosamente`);
    return response;
}

/**
 * FUNCIÓN PRINCIPAL: Procesar código de filtro
 */
async function processFilterCode(inputCode) {
    try {
        // NODO 2: Validar y normalizar
        const { normalized } = await validateAndCheckCache(inputCode);

        // NODO 3: Consultar base de datos maestra
        const matchResult = await queryMasterDatabase(normalized);

        // NODO 4: Generar SKU
        const skuGeneration = generateFinalSku(matchResult.rawData, normalized);

        // NODO 5: Construir respuesta
        const response = buildResponse(matchResult.source, matchResult.rawData, skuGeneration, normalized);

        console.log(`[ÉXITO] Código ${normalized} procesado exitosamente → SKU: ${skuGeneration.sku}`);
        return response;

    } catch (error) {
        // Si no se encuentra en BD, retornar error
        if (error.status === 404) {
            console.log(`[ERROR] Código no encontrado en base de datos: ${inputCode}`);
            throw error;
        }

        // Otros errores
        console.error(`[ERROR CRÍTICO] Error procesando ${inputCode}:`, error);
        throw {
            status: 500,
            safeErrorResponse: {
                results: [{
                    error: "PROCESSING_ERROR",
                    message: "Error interno procesando el código.",
                    details: error.message || "Unknown error",
                    ok: false
                }]
            }
        };
    }
}

module.exports = {
    processFilterCode
};
