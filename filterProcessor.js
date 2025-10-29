// filterProcessor.js (Orquestador Interno - ACTUALIZADO v2.2.0)
const dataAccess = require('./dataAccess');
const homologationDB = require('./homologationDB');
const businessLogic = require('./businessLogic');
const jsonBuilder = require('./jsonBuilder');
const OpenAI = require('openai');

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    let normalizedCode = String(inputCode)
        .toUpperCase()
        .trim()
        .replace(/[\s\-/]/g, '');

    if (normalizedCode.length < 4) {
        throw {
            status: 400,
            safeErrorResponse: {
                results: [{
                    error: "INVALID_CODE",
                    message: "CÓDIGO INVÁLIDO. Mínimo 4 caracteres requeridos.",
                    query_norm: normalizedCode,
                    ok: false
                }]
            }
        };
    }

    try {
        const cachedData = await dataAccess.readFromCache(normalizedCode);
        if (cachedData) {
            console.log(`[NODO 2] ✓ Cache hit para ${normalizedCode}`);
            return {
                valid: true,
                status: "CACHED",
                normalized: normalizedCode,
                cachedData
            };
        }
    } catch (cacheError) {
        console.warn(`[NODO 2] ⚠ Error reading cache: ${cacheError.message}. Continuando con búsqueda.`);
    }

    return {
        valid: true,
        status: "NEW",
        normalized: normalizedCode
    };
}

/**
 * NODO 3: Búsqueda en base de datos maestra
 */
async function findAndValidateMasterData(normalizedCode) {
    try {
        const { found, rawData } = await homologationDB.findExactHomologation(normalizedCode);

        if (!found || !rawData) {
            throw new Error("Código no encontrado en base de datos maestra");
        }

        try {
            businessLogic.validateMasterDataIntegrity(rawData);
        } catch (integrityError) {
            console.error(`[NODO 3] Data maestra corrupta para ${normalizedCode}:`, integrityError.message);
            throw integrityError;
        }

        console.log(`[NODO 3] ✓ Data maestra encontrada y validada para ${normalizedCode}`);
        return rawData;

    } catch (error) {
        throw {
            status: 404,
            safeErrorResponse: {
                results: [{
                    error: "NOT_FOUND",
                    message: "CÓDIGO NO ENCONTRADO EN BASE DE DATOS MAESTRA.",
                    query_norm: normalizedCode,
                    details: error.message,
                    ok: false
                }]
            }
        };
    }
}

/**
 * NODO 3.5: Validador Ciego de IA
 */
function validateAIGeneration(aiData) {
    console.log('[NODO 3.5] Validando datos generados por IA...');

    const validFamilies = ['FUEL', 'AIR', 'OIL', 'HYDRAULIC', 'ACEITE', 'COMBUSTIBLE', 'AIRE', 'HIDRAULIC', 
                          'CABIN', 'FUEL SEPARATOR', 'AIR DRYER', 'COOLANT', 'CARCAZA AIR FILTER', 
                          'TURBINE SERIES', 'KITS SERIES HD', 'KITS SERIES LD'];
    
    if (!aiData.family || !validFamilies.some(f => f.toLowerCase() === aiData.family.toLowerCase())) {
        console.warn('[NODO 3.5] ✗ Validación fallida: Familia inválida');
        return null;
    }

    const validDuty = ['HD', 'LD', 'HEAVY', 'LIGHT'];
    if (!aiData.duty || !validDuty.some(d => d.toLowerCase() === aiData.duty.toLowerCase())) {
        console.warn('[NODO 3.5] ✗ Validación fallida: Duty inválido');
        return null;
    }

    if (!aiData.oem_codes || (Array.isArray(aiData.oem_codes) && aiData.oem_codes.length === 0)) {
        console.warn('[NODO 3.5] ✗ Validación fallida: Sin códigos OEM');
        return null;
    }

    console.log('[NODO 3.5] ✓ Validación de IA exitosa');
    return aiData;
}

/**
 * NODO 4: Generación con OpenAI (con validación)
 */
async function generateWithOpenAI(normalizedCode) {
    try {
        console.log(`[NODO 4] Generando nuevo filtro con OpenAI para: ${normalizedCode}`);

        const prompt = `Analiza este código de filtro OEM: '${normalizedCode}'
        
        Extrae en formato JSON:
        - family: (Tipo: AIR, FUEL, OIL, HYDRAULIC, CABIN, FUEL SEPARATOR, AIR DRYER, COOLANT, CARCAZA AIR FILTER, TURBINE SERIES, KITS SERIES HD, KITS SERIES LD)
        - duty: (HD para Heavy Duty o LD para Light Duty)
        - oem_codes: (Array de códigos OEM encontrados)
        - cross_references: (Array de referencias cruzadas)
        - brand: (Marca detectada: DONALDSON, FRAM, CATERPILLAR, etc.)
        
        Responde SOLO con el JSON válido.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });

        const aiResponse = JSON.parse(completion.choices[0].message.content);

        const validatedData = validateAIGeneration(aiResponse);

        if (!validatedData) {
            throw new Error("La generación de OpenAI no pasó la validación de seguridad.");
        }

        return {
            source: "AI_GENERATED",
            rawData: {
                filter_family: validatedData.family,
                duty_level: validatedData.duty.toUpperCase() === 'HEAVY' ? 'HD' : 
                           validatedData.duty.toUpperCase() === 'LIGHT' ? 'LD' : 
                           validatedData.duty.toUpperCase(),
                priority_reference: validatedData.cross_references?.[0] || normalizedCode,
                priority_brand: validatedData.brand || 'UNKNOWN',
                cross_reference: validatedData.cross_references || [],
                oem_codes: validatedData.oem_codes || [],
                specs: {},
            }
        };

    } catch (error) {
        console.error(`[NODO 4] ✗ Error en generación con OpenAI: ${error.message}`);
        throw error;
    }
}

/**
 * NODO 4: Clasificación y generación de SKU - ACTUALIZADO
 */
function generateFinalSku(rawData, normalizedCode) {
    try {
        const duty = businessLogic.determineDutyLevel(
            rawData.filter_family,
            rawData.specs,
            rawData.oem_codes,
            rawData.cross_reference,
            rawData
        );

        if (!duty) {
            throw new Error("Duty level vacío después de determinación");
        }

        // === NUEVO: Usar applyBaseCodeLogic con priority_reference ===
        const baseCodeTarget = businessLogic.applyBaseCodeLogic(
            duty, 
            rawData.filter_family, 
            rawData.oem_codes, 
            rawData.cross_reference,
            rawData.priority_reference // <-- AGREGADO
        );

        if (!baseCodeTarget) {
            throw new Error("Base code logic retornó valor vacío");
        }

        // === NUEVO: Usar extractLast4Digits ===
        const baseCode = businessLogic.extractLast4Digits(baseCodeTarget);

        // === ACTUALIZADO: Pasar duty al getElimfiltersPrefix ===
        const prefix = businessLogic.getElimfiltersPrefix(rawData.filter_family, duty);
        
        if (!prefix) {
            throw new Error(`Prefijo vacío para familia: ${rawData.filter_family}`);
        }

        // === NUEVO FORMATO: Sin guiones ===
        const finalSku = prefix + baseCode;

        console.log(`[NODO 4] ✓ SKU generado: ${finalSku} (duty: ${duty}, family: ${rawData.filter_family}, baseCode source: ${baseCodeTarget})`);

        return {
            finalSku,
            duty,
            baseCode,
            prefix,
            baseCodeSource: baseCodeTarget // Para trazabilidad
        };

    } catch (error) {
        throw {
            status: 500,
            safeErrorResponse: {
                results: [{
                    error: "SKU_GENERATION_FAILED",
                    message: "Error al generar SKU.",
                    details: error.message,
                    ok: false
                }]
            }
        };
    }
}

/**
 * NODO 4.5: Persistencia en data maestra y caché
 */
async function persistProcessedData(processedData, normalizedCode) {
    try {
        await dataAccess.writeToMasterAndCache(processedData);
        console.log(`[NODO 4.5] ✓ Datos persistidos para ${normalizedCode}`);
        return true;
    } catch (persistError) {
        console.error(`[NODO 4.5] ⚠ Error al persistir datos: ${persistError.message}`);
        return false;
    }
}

/**
 * NODO 5: Construcción de respuesta JSON
 */
function buildResponse(processedData) {
    try {
        const response = jsonBuilder.buildFilterResponse(processedData);
        console.log(`[NODO 5] ✓ Respuesta JSON construida`);
        return response;
    } catch (error) {
        throw {
            status: 500,
            safeErrorResponse: {
                results: [{
                    error: "RESPONSE_BUILD_FAILED",
                    message: "Error al construir respuesta.",
                    details: error.message,
                    ok: false
                }]
            }
        };
    }
}

/**
 * FUNCIÓN PRINCIPAL: Orquesta todo el flujo
 */
async function processFilterCode(inputCode, options = {}) {
    console.log(`[INICIO] Procesando código: ${inputCode}`);

    try {
        const validationResult = await validateAndCheckCache(inputCode);
        const normalized = validationResult.normalized;

        if (validationResult.status === "CACHED") {
            console.log(`[FLUJO] Retornando datos cacheados para ${normalized}`);
            return buildResponse(validationResult.cachedData);
        }

        const rawData = await findAndValidateMasterData(normalized);
        const skuGeneration = generateFinalSku(rawData, normalized);

        const processedData = {
            queryNorm: normalized,
            sku: skuGeneration.finalSku,
            duty: skuGeneration.duty,
            filterType: rawData.filter_family,
            family: rawData.filter_family,
            specs: rawData.specs,
            oemCodes: rawData.oem_codes,
            crossReference: rawData.cross_reference,
            baseCode: skuGeneration.baseCode,
            prefix: skuGeneration.prefix,
            baseCodeSource: skuGeneration.baseCodeSource,
            timestamp: new Date().toISOString(),
            source: "MASTER_DATA"
        };

        const persistSuccessful = await persistProcessedData(processedData, normalized);
        processedData.cached = persistSuccessful;

        const response = buildResponse(processedData);

        console.log(`[ÉXITO] Código ${normalized} procesado exitosamente → SKU: ${skuGeneration.finalSku}`);
        return response;

    } catch (error) {
        if (error.status === 404) {
            console.log(`[FLUJO] Código no encontrado en BD maestra. Intentando generar con IA...`);
            try {
                const aiGeneratedData = await generateWithOpenAI(error.safeErrorResponse.results[0].query_norm);
                const skuGeneration = generateFinalSku(aiGeneratedData.rawData, error.safeErrorResponse.results[0].query_norm);

                const processedData = {
                    queryNorm: error.safeErrorResponse.results[0].query_norm,
                    sku: skuGeneration.finalSku,
                    duty: skuGeneration.duty,
                    filterType: aiGeneratedData.rawData.filter_family,
                    family: aiGeneratedData.rawData.filter_family,
                    specs: aiGeneratedData.rawData.specs,
                    oemCodes: aiGeneratedData.rawData.oem_codes,
                    crossReference: aiGeneratedData.rawData.cross_reference,
                    baseCode: skuGeneration.baseCode,
                    prefix: skuGeneration.prefix,
                    baseCodeSource: skuGeneration.baseCodeSource,
                    timestamp: new Date().toISOString(),
                    source: "AI_GENERATED"
                };

                const persistSuccessful = await persistProcessedData(processedData, error.safeErrorResponse.results[0].query_norm);
                processedData.cached = persistSuccessful;

                const response = buildResponse(processedData);

                console.log(`[ÉXITO IA] Código ${error.safeErrorResponse.results[0].query_norm} generado y procesado → SKU: ${skuGeneration.finalSku}`);
                return response;

            } catch (aiError) {
                console.error(`[ERROR IA] La generación con IA falló: ${aiError.message}`);
                return error.safeErrorResponse;
            }
        }

        console.error(`[ERROR] Procesamiento fallido:`, error);

        if (error.safeErrorResponse) {
            return error.safeErrorResponse;
        }

        return {
            results: [{
                error: "PROCESSING_ERROR",
                message: "Error interno al procesar el código.",
                details: error.message,
                ok: false
            }],
            metadata: { success: false }
        };
    }
}

async function testProcessor(testCode) {
    console.log(`\n[TEST] Iniciando test con código: ${testCode}`);
    try {
        const result = await processFilterCode(testCode);
        console.log(`[TEST] Resultado:`, JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error(`[TEST] Error:`, error);
        throw error;
    }
}

module.exports = {
    processFilterCode,
    testProcessor
};
