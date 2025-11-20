// ============================================================================
// ELIMFILTERS — JSON BUILDER v3.0
// Genera respuestas totalmente estandarizadas para el Master Sheet y API.
// ============================================================================

function sanitizeList(list) {
    if (!list) return [];
    if (Array.isArray(list)) return list.slice(0, 10);

    return String(list)
        .split(/[,;\n]+/)
        .map(x => x.trim())
        .filter(Boolean)
        .slice(0, 10);
}

function buildStandardResponse(data) {
    return {
        ok: true,
        query_norm: data.queryNorm || "",
        sku: data.sku || "",
        family: data.family || "",
        duty: data.duty || "",
        filter_type: data.filterType || "",
        subtype: data.subtype || "",
        media_type: data.mediaType || "",
        description: data.description || "",
        oem_codes: sanitizeList(data.oemCodes),
        cross_reference: sanitizeList(data.crossReference),
        engine_applications: sanitizeList(data.engineApplications),
        equipment_applications: sanitizeList(data.equipmentApplications),
        specs: data.specs || {},
        prefix: data.prefix || "",
        base_code: data.baseCode || "",
        source: data.source || "ENGINE",
        confidence: data.confidence || "HIGH",
        homologated_sku: data.homologated_sku || data.sku || "",
        priority_reference: data.priority_reference || "",
        priority_brand_reference: data.priority_brand_reference || ""
    };
}

function buildErrorResponse(data) {
    return {
        ok: false,
        query_norm: data.query_norm || "",
        error: data.error || "UNKNOWN",
        message: data.message || "Error no especificado.",
        details: data.details || null
    };
}

module.exports = {
    buildStandardResponse,
    buildErrorResponse,
    sanitizeList
};
