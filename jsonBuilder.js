// ============================================================================
// jsonBuilder.js – Formateador oficial de respuestas ELIMFILTERS
// Genera respuestas uniformes para MASTER, detección, errores y homologación.
// ============================================================================

function padFields(data, headers = []) {
    const padded = { ...data };
    headers.forEach(h => {
        if (!(h in padded)) padded[h] = "";
    });
    return padded;
}

// ============================================================================
// RESPUESTA ESTÁNDAR (para resultados válidos)
// ============================================================================
function buildStandardResponse({
    queryNorm,
    sku,
    family,
    duty,
    specs = {},
    oemCodes = [],
    crossReference = [],
    baseCode = "",
    prefix = "",
    description = "",
    filterType = "",
    mediaType = "",
    subtype = "",
    source = "MASTER_DB",
    confidence = "HIGH"
}) {
    return {
        ok: true,
        query_norm: queryNorm,
        sku,
        family,
        duty,
        description,
        filter_type: filterType,
        media_type: mediaType,
        subtype,
        specs,
        oem_codes: formatList(oemCodes),
        cross_reference: formatList(crossReference),
        base_code: baseCode,
        prefix,
        source,
        confidence
    };
}

// ============================================================================
// RESPUESTA DE ERROR
// ============================================================================
function buildErrorResponse({
    query_norm = "",
    error = "UNKNOWN_ERROR",
    message = "Error desconocido.",
    details = null,
    ok = false
}) {
    const payload = {
        ok,
        query_norm,
        error,
        message
    };
    if (details) payload.details = details;
    return payload;
}

// ============================================================================
// FORMATO DE ARRAYS → STRING (máx 10 valores)
// ============================================================================
function formatList(raw) {
    if (!raw) return "";
    const arr = Array.isArray(raw)
        ? raw
        : String(raw).split(/[,;\n]+/);

    const cleaned = arr
        .map(s => String(s).trim().toUpperCase())
        .filter(s => s)
        .map(s => s.replace(/[^A-Z0-9\-]/g, ""));

    return cleaned.slice(0, 10).join(",");
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    buildStandardResponse,
    buildErrorResponse,
    formatList,
    padFields
};
