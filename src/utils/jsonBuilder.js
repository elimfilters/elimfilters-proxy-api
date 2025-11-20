// ============================================================================
// ELIMFILTERS — JSON BUILDER v4.0
// Estandariza todas las respuestas del motor de búsqueda.
// Incluye: respuestas estándar, múltiples, errores y sanitización.
// ============================================================================

function sanitizeList(value) {
    if (!value) return [];

    const arr = Array.isArray(value) ? value : String(value).split(/[,;\n]+/);

    return arr
        .map(s => String(s).trim().toUpperCase())
        .filter(s => !!s)
        .map(s => s.replace(/[^A-Z0-9\-]/g, ''))
        .slice(0, 10); // máximo 10 como definiste
}

/**
 * Construye una fila normalizada para el Master Sheet
 */
function buildStandardResponse(data) {
    const {
        queryNorm,
        sku,
        duty,
        family,
        description,
        oemCodes,
        crossReference,
        filterType,
        subtype,
        mediaType,
        specs,
        primary
    } = data;

    return {
        ok: true,
        query_norm: queryNorm || "",
        sku: sku || "",
        family: family || "",
        duty: duty || "",
        description: description || "",
        filter_type: filterType || "Oil Filter",
        subtype: subtype || "SPIN-ON",
        media_type: mediaType || "",
        
        oem_codes: sanitizeList(oemCodes),
        cross_reference: sanitizeList(crossReference),

        specs: specs || {},

        primary: primary === true,

        source: "ENGINE",

        timestamp: new Date().toISOString()
    };
}

/**
 * Construye respuesta para MULTI-SKU (cuando un OEM produce varios Donaldson)
 */
function buildMultiResponse(oemCode, list) {
    return {
        ok: true,
        query_norm: oemCode,
        multi: true,
        results: list.map((x, idx) => ({
            ...x,
            primary: idx === 0,
        })),
        count: list.length,
        source: "ENGINE_MULTI",
        timestamp: new Date().toISOString()
    };
}

/**
 * Error general
 */
function buildErrorResponse(err) {
    return {
        ok: false,
        ...err,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    buildStandardResponse,
    buildErrorResponse,
    buildMultiResponse
};
