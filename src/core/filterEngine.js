// ============================================================================
// ELIMFILTERS — FILTER ENGINE v4.0 (FINAL)
// Motor oficial con soporte para multi-equivalencias, prefijos correctos,
// reglas HD/LD, Donaldson/Fram, OEM prioritario y SKU único por cada referencia.
// ============================================================================

const detectionService = require("../services/detectionService");
const filterProcessor = require("../processors/filterProcessor");
const homologationDB = require("../services/homologationDB");
const dataAccess = require("../services/dataAccess");
const jsonBuilder = require("../utils/jsonBuilder");

// ============================================================================
// NORMALIZACIÓN
// ============================================================================
function normalizeInput(code) {
    if (!code || typeof code !== "string") {
        return "";
    }
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

    const detection = detectionService.detectCodeType(normalized);
    console.log(`[ENGINE] Tipo detectado → ${detection.type}`);

    switch (detection.type) {
        case "SKU":
            return processSKU(normalized);
        case "OEM":
            return processOEM(normalized);
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
async function processSKU(sku) {
    console.log(`[ENGINE] Buscando por SKU directo → ${sku}`);

    const record = await dataAccess.queryBySKU(sku);
    if (!record) {
        return jsonBuilder.buildErrorResponse({
            query_norm: sku,
            error: "SKU_NOT_FOUND",
            message: `El SKU '${sku}' no existe en la base de datos.`,
            ok: false
        });
    }
    return jsonBuilder.buildStandardResponse(record);
}

// ============================================================================
// MANEJO OEM / CROSS (MULTI-SKU INCLUIDO)
// ============================================================================
async function processOEM(code) {
    console.log(`[ENGINE] Procesando OEM/CROSS → ${code}`);

    try {
        const result = await filterProcessor.processFilterCode(code);

        // Si es single-equivalencia → retornar normal
        if (result.results.length === 1) {
            console.log(`[ENGINE] Resultado simple → SKU ${result.results[0].sku}`);
            return result;
        }

        // Si hay múltiple equivalencias
        console.log(`[ENGINE] MULTI-EQUIVALENCIA DETECTADA → ${result.results.length} SKUs generados`);

        // Registrar en base de datos de auditoría de multi-equivalencias
        homologationDB.saveMultiEquivalence(
            code,
            result.results.map(e => e.sku)
        );

        return result;

    } catch (err) {
        if (err.status === 404) {
            console.log(`[ENGINE] Código desconocido → se envía a homologación`);
            homologationDB.saveUnknownCode(code);

            return jsonBuilder.buildErrorResponse({
                query_norm: code,
                error: "NOT_FOUND_SENT_TO_HOMOLOGATION",
                message: `El código '${code}' no existe en la base de datos. Se envió a homologación.`,
                ok: false
            });
        }

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
