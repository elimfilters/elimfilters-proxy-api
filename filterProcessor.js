// filterProcessor.js (Orquestador Interno - Flujo Completo Corregido con IA)
const dataAccess = require('./dataAccess');
const homologationDB = require('./homologationDB');
const businessLogic = require('./businessLogic');
const jsonBuilder = require('./jsonBuilder');
const OpenAI = require('openai'); // === NUEVO ===

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // === NUEVO === (Asegúrate de añadir esta variable a tu .env)
});

/**
 * NODO 2: Validación y Normalización de entrada
 */
async function validateAndCheckCache(inputCode) {
    // Validar entrada
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

    // Validar longitud mínima
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

    // NODO 4.5: Intento de lectura de caché
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

        // Validar integridad de data maestra
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
 * === NUEVO ===
 * Verifica que la respuesta de OpenAI sea coherente y segura antes de usarla.
 */
function validateAIGeneration(aiData) {
    console.log('[NODO 3.5] Validando datos generados por IA...');

    // Regla 1: ¿La familia es válida?
    const validFamilies = ['FUEL', 'AIR', 'OIL', 'HYDRAULIC', 'ACEITE', 'COMBUSTIBLE', 'AIRE', 'HIDRÁULICO'];
    if (!aiData.family || !validFamilies.includes(aiData.family.toUpperCase())) {
        console.warn('[NODO 3.5] ✗ Validación fallida: Familia inválida');
        return null; // Falla la validación
    }

    // Regla 2: ¿El duty es válido?
    const validDuty = ['HD', 'LD', 'STANDARD', 'LIGHT', 'HEAVY'];
    if (!aiData.duty || !validDuty.includes(aiData.duty.toUpperCase())) {
        console.warn('[NODO 3.5] ✗ Validación fallida: Duty inválido');
        return null; // Falla la validación
    }

    // Regla 3: ¿Hay códigos OEM?
    if (!aiData.oem_codes || (Array.isArray(aiData.oem_codes) && aiData.oem_codes.length === 0)) {
        console.warn('[NODO 3.5] ✗ Validación fallida: Sin códigos OEM');
        return null; // Falla la validación
    }

    console.log('[NODO 3.5] ✓ Validación de IA exitosa');
    return aiData; // La validación es exitosa
}

/**
 * NODO 4: Generación con OpenAI (con validación)
 * === NUEVO ===
 */
async function generateWithOpenAI(normalizedCode) {
    try {
        console.log(`[NODO 4] Generando nuevo filtro con OpenAI para: ${normalizedCode}`);

        const prompt = `Analiza este código de filtro OEM: '${normalizedCode}'
        
        Extrae en formato JSON:
        - family: (Tipo de familia: Fuel, Air, Hydraulic, Oil, etc.)
        - duty: (HD o LD)
        - oem_codes: (Códigos OEM encontrados)
        - cross_references: (Referencias cruzadas)
        - filter_type: (Tipo de filtro)
        - brand: (Marca detectada)
        
        Responde SOLO con el JSON válido.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });

        const aiResponse = JSON.parse(completion.choices[0].message.content);

        // PASAR LA RESPUESTA POR EL VALIDADOR CIEGO
        const validatedData = validateAIGeneration(aiResponse);

        if (!validatedData) {
            throw new Error("La generación de OpenAI no pasó la validación de seguridad.");
        }

        return {
            source: "AI_GENERATED",
            rawData: {
                // Convertimos el formato de IA al formato que espera el servidor
                filter_family: validatedData.family,
                duty_level: validatedData.duty,
                priority_reference: validatedData.cross_references?.[0] || normalizedCode,
                priority_brand: validatedData.brand || 'UNKNOWN',
                cross_reference: validatedData.cross_references || [],
                oem_codes: validatedData.oem_codes || [],
                specs: {}, // OpenAI no da specs, dejamos vacío por ahora
            }
        };

    } catch (error) {
        console.error(`[NODO 4] ✗ Error en generación con OpenAI: ${error.message}`);
        // Relanzamos el error para que el flujo principal lo maneje
        throw error;
    }
}

/**
 * NODO 4: Clasificación y generación de SKU
 */
function generateFinalSku(rawData, normalizedCode) {
    try {
        // Obtener duty level (ya validado en data maestra)
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

        // Obtener base code
        const baseCodeTarget = rawData.priority_reference ||
            businessLogic.applyBaseCodeLogic(duty, rawData.filter_family, rawData.oem_codes, rawData.cross_reference);

        if (!baseCodeTarget) {
            throw new Error("Base code logic retornó valor vacío");
        }

        // Extraer números y obtener últimos 4 dígitos
        const numericCode = baseCodeTarget.replace(/[^0-9]/g, '');
        if (!numericCode || numericCode.length === 0) {
            throw new Error(`No se encontraron dígitos en base code: ${baseCodeTarget}`);
        }

        const baseCode = numericCode.slice(-4);

        // Obtener prefijo
        const prefix = businessLogic.getElimfiltersPrefix(rawData.filter_family);
        if (!prefix) {
            throw new Error(`Prefijo vacío para familia: ${rawData.filter_family}`);
        }

        const finalSku = prefix + baseCode;

        console.log(`[NODO 4] ✓ SKU generado: ${finalSku} (duty: ${duty}, family: ${rawData.filter_family})`);

        return {
            finalSku,
            duty,
            baseCode,
            prefix
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
        // No fallar el flujo si la persistencia falla
        // El dato se retorna pero no se guarda
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
 * === MODIFICADO ===
 */
async function processFilterCode(inputCode, options = {}) {
    console.log(`[INICIO] Procesando código: ${inputCode}`);

    try {
        // NODO 2: Validación y caché
        const validationResult = await validateAndCheckCache(inputCode);
        const normalized = validationResult.normalized;

        if (validationResult.status === "CACHED") {
            console.log(`[FLUJO] Retornando datos cacheados para ${normalized}`);
            return buildResponse(validationResult.cachedData);
        }

        // NODO 3: Búsqueda en data maestra
        const rawData = await findAndValidateMasterData(normalized);

        // NODO 4: Generación de SKU
        const skuGeneration = generateFinalSku(rawData, normalized);

        // Construir datos procesados
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
            timestamp: new Date().toISOString(),
            source: "MASTER_DATA"
        };

        // NODO 4.5: Persistencia (no bloquea si falla)
        const persistSuccessful = await persistProcessedData(processedData, normalized);
        processedData.cached = persistSuccessful;

        // NODO 5: Construcción de respuesta
        const response = buildResponse(processedData);

        console.log(`[ÉXITO] Código ${normalized} procesado exitosamente → SKU: ${skuGeneration.finalSku}`);
        return response;

    } catch (error) {
        // === NUEVA LÓGICA DE OPENAI ===
        if (error.status === 404) {
            console.log(`[FLUJO] Código no encontrado en BD maestra. Intentando generar con IA...`);
            try {
                // NODO 4: Generar con OpenAI
                const aiGeneratedData = await generateWithOpenAI(error.safeErrorResponse.results[0].query_norm);
                
                // NODO 4.5: Generar SKU a partir de los datos de la IA
                const skuGeneration = generateFinalSku(aiGeneratedData.rawData, error.safeErrorResponse.results[0].query_norm);

                // Construir datos procesados
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
                    timestamp: new Date().toISOString(),
                    source: "AI_GENERATED" // Marcar como generado por IA
                };

                // NODO 4.5: Persistencia (no bloquea si falla)
                const persistSuccessful = await persistProcessedData(processedData, error.safeErrorResponse.results[0].query_norm);
                processedData.cached = persistSuccessful;

                // NODO 5: Construcción de respuesta
                const response = buildResponse(processedData);

                console.log(`[ÉXITO IA] Código ${error.safeErrorResponse.results[0].query_norm} generado y procesado → SKU: ${skuGeneration.finalSku}`);
                return response;

            } catch (aiError) {
                console.error(`[ERROR IA] La generación con IA falló: ${aiError.message}`);
                // Si la IA también falla, devolvemos el error original de "no encontrado".
                return error.safeErrorResponse;
            }
        }

        // LÓGICA ORIGINAL DE MANEJO DE ERRORES
        console.error(`[ERROR] Procesamiento fallido:`, error);

        // Si el error ya es un objeto de respuesta formateado, retornarlo
        if (error.safeErrorResponse) {
            return error.safeErrorResponse;
        }

        // Si no, construir respuesta de error genérica
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

/**
 * Función auxiliar para testing
 */
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

// ============================================================================
// EXPORTACIONES (CommonJS)
// ============================================================================

module.exports = {
    processFilterCode,
    testProcessor
};
