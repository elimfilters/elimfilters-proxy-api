// ============================================================================
// ELIMFILTERS - FILTER ENGINE V4.0.0
// Motor central: normalización, clasificación, SKU, homologación y respuesta.
// Autorizado para ambiente de producción.
// ============================================================================

const detectionService = require("../services/detectionService");
const filterProcessor = require("../processors/filterProcessor");
const homologationDB = require("../services/homologationDB");
const dataAccess = require("../services/dataAccess");
const jsonBuilder = require("../utils/jsonBuilder");

// ============================================================================
// NORMALIZACIÓN UNIVERSAL
// ============================================================================
function normalizeInput(code) {
    if (!code || typeof code !== "string") return "";
    return code.trim().toUpperCase().replace(/\s+/g, "");
}

// ============================================================================
// PROCESADOR PRINCIPAL
// ============================================================================
async function processCode(inputCode) {
    const normalized = normalizeInput(inputCode);

    if (!normalized) {
        return jsonBuilder.buildErrorResponse({
            error: "EMPTY_CODE",
            message: "Debe ingresar un código OEM, Cross Reference o SKU.",
            ok: false
        });
    }

    console.log(`[ENGINE] Código recibido → ${normalized}`);

    // 1. Determinar tipo de código
    const detection = detectionService.detectCodeType(normalized);
    console.log(`[ENGINE] Tipo detectado → ${detection.type}`);

    switch (detection.type) {

        // --------------------------------------------------------------------
        // SKU DIRECTO (EL8xxxx, EA1xxxx, EF9xxxx, etc.)
        // --------------------------------------------------------------------
        case "SKU":
            return handleSKU(normalized);

        // --------------------------------------------------------------------
        // OEM / CROSS REFERENCE
        // --------------------------------------------------------------------
        case "OEM":
            return handleOEM(normalized);

        // --------------------------------------------------------------------
        // DESCONOCIDO
        // --------------------------------------------------------------------
        default:
            return jsonBuilder.buildErrorResponse({
                query_norm: normalized,
                error: "UNRECOGNIZED_CODE",
                message: "El código ingresado no coincide con ningún formato válido.",
                ok: false
            });
    }
}

// ============================================================================
// MANEJO SKU DIRECTO
// ============================================================================
async function handleSKU(sku) {
    console.log(`[ENGINE] Buscando por SKU → ${sku}`);

    const record = await dataAccess.queryBySKU(sku);

    if (!record) {
        return jsonBuilder.buildErrorResponse({
            query_norm: sku,
            error: "SKU_NOT_FOUND",
            message: `El SKU '${sku}' no existe en la base de datos.`,
            ok: false
        });
    }

    return jsonBuilder.buildStandardResponse({
        queryNorm: sku,
        sku: record.sku,
        duty: record.duty,
        family: record.family,
        filterType: record.filter_type,
        subtype: record.subtype,
        specs: record.specs || {},
        oemCodes: record.oem_codes || [],
        crossReference: record.cross_reference || [],
        baseCode: record.base_code || "",
        prefix: record.prefix,
        source: "MASTER",
        confidence: "HIGH"
    });
}

// ============================================================================
// MANEJO OEM / CROSS
// ============================================================================
async function handleOEM(code) {
    console.log(`[ENGINE] Procesando OEM/CROSS → ${code}`);

    try {
        // 1. Procesar el código con el motor interno
        const result = await filterProcessor.processFilterCode(code);

        console.log(`[ENGINE] Procesamiento interno completado → SKU ${result.results[0].sku}`);
        return result;

    } catch (err) {

        // - - - - - - - - - - - - - - - - - - - - -
        // Código no está en BD → enviar a homologación
        // - - - - - - - - - - - - - - - - - - - - -
        if (err.status === 404) {
            console.log(`[ENGINE] Código no existe en BD → enviado a homologación`);

            await homologationDB.saveUnknownCode(code);

            return jsonBuilder.buildErrorResponse({
                query_norm: code,
                error: "NOT_FOUND_SENT_TO_HOMOLOGATION",
                message: `El código '${code}' no existe en la base de datos. Se envió a homologación.`,
                ok: false
            });
        }

        // Error interno inesperado
        console.error(`[ENGINE] ERROR INTERNO`, err);

        return jsonBuilder.buildErrorResponse({
            query_norm: code,
            error: "ENGINE_FAILURE",
            message: "Error interno procesando el código.",
            details: err.message || "Unknown internal error",
            ok: false
        });
    }
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    processCode
};
