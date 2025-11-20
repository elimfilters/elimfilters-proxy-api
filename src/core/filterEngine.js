// ============================================================================
// ELIMFILTERS — FILTER ENGINE v3.0
// Motor central de Construcción de SKU + Multi-Equivalencias
// ============================================================================

const detectionService = require("../services/detectionService");
const filterProcessor = require("../processors/filterProcessor");
const homologationDB = require("./homologationDB");
const dataAccess = require("../services/dataAccess");
const jsonBuilder = require("../utils/jsonBuilder");

// ============================================================================
// OEM LIST DEFINITIVO (OFICIAL ELIMFILTERS)
// ============================================================================
const OEM_LIST = [
    "CATERPILLAR", "KOMATSU", "TOYOTA", "NISSAN", "JOHN DEERE", "FORD",
    "VOLVO", "VOLVO CE", "VOLVO TRUCKS", "KUBOTA", "HITACHI", "CASE",
    "NEW HOLLAND", "ISUZU", "HINO", "YANMAR", "MITSUBISHI FUSO",
    "HYUNDAI", "SCANIA", "MERCEDES", "CUMMINS", "PERKINS",
    "DOOSAN", "MACK", "MAN", "RENAULT TRUCKS", "DEUTZ", "DETROIT",
    "INTERNATIONAL", "NAVISTAR"
];

// ============================================================================
// PREFIJOS
// ============================================================================
const PREFIX_MAP = {
    AIR: "EA1",
    OIL: "EL8",
    FUEL: "EF9",
    HYDRAULIC: "EH6",
    CABIN: "EC1",
    CARCAZAS: "EA2",
    AIRDRYER: "ED4",
    COOLANT: "EW7",
    FUELSEP: "ES9",
    KITHD: "EK5",
    KITLD: "EK6"
};

// ============================================================================
// MEDIA TYPE
// ============================================================================
function resolveMedia(family) {
    switch (family) {
        case "AIR":
        case "CARCAZAS":
            return "MACROCORE™";
        case "CABIN":
            return "MICROKAPPA™";
        default:
            return "ELIMTEK™";
    }
}

// ============================================================================
// DETERMINAR SI ES OEM
// ============================================================================
function isOEM(brand) {
    if (!brand) return false;
    const upper = brand.toUpperCase();
    return OEM_LIST.includes(upper);
}

// ============================================================================
// NORMALIZAR CÓDIGO
// ============================================================================
function normalizeInput(str) {
    if (!str || typeof str !== "string") return "";
    return str.trim().toUpperCase().replace(/\s+/g, "");
}

// ============================================================================
// EXTRAER MARCA DEL CÓDIGO OEM (Caterpillar, Komatsu, Toyota…)
// ============================================================================
function extractBrand(codeObj) {
    if (!codeObj || !codeObj.brand) return null;
    return codeObj.brand.toUpperCase();
}

// ============================================================================
// GENERAR 4 DÍGITOS BASE SEGÚN HD / LD
// ============================================================================
async function resolveLast4Digits(codeObj, duty, family) {
    const brand = extractBrand(codeObj);

    const is_oem = isOEM(brand);

    // ===============================
    // PRIORIDAD: DONALDSON (HD)
    // ===============================
    if (duty === "HD") {
        const d = await filterProcessor.findDonaldson(codeObj.code);
        if (d) return d.code.slice(-4); // OK
        // Si no existe → usar OEM si es OEM
        if (is_oem) return codeObj.code.replace(/\D/g, "").slice(-4);
    }

    // ===============================
    // PRIORIDAD: FRAM (LD)
    // ===============================
    if (duty === "LD") {
        const f = await filterProcessor.findFRAM(codeObj.code);
        if (f) return f.code.slice(-4);
        // Si no lo fabrica → usar últimos 4 OEM
        return codeObj.code.replace(/\D/g, "").slice(-4);
    }

    // Fallback universal
    return codeObj.code.replace(/\D/g, "").slice(-4);
}

// ============================================================================
// CONSTRUIR UN SKU
// ============================================================================
function buildSKU(prefix, last4) {
    return `${prefix}${last4}`;
}

// ============================================================================
// PROCESAR CÓDIGO CON MULTI-EQUIVALENCIAS
// ============================================================================
async function processOEM(codeObj) {
    const { code, brand, family, duty, equivalents } = codeObj;

    const prefix = PREFIX_MAP[family];
    const media = resolveMedia(family);

    if (!prefix || !family) {
        return jsonBuilder.buildErrorResponse({
            query_norm: code,
            error: "UNKNOWN_FAMILY",
            message: `No se pudo clasificar familia para '${code}'`
        });
    }

    // ========================================================================
    // SI NO HAY EQUIVALENTES → envío a homologación
    // ========================================================================
    if (!equivalents || equivalents.length === 0) {
        await homologationDB.saveUnknownCode(code);
        return jsonBuilder.buildErrorResponse({
            query_norm: code,
            error: "NOT_FOUND_SENT_TO_HOMOLOGATION",
            message: `No hay equivalentes para ${code}.`
        });
    }

    // ========================================================================
    // MULTI-EQUIVALENCIAS (GENERAR 1 SKU POR CADA EQUIVALENTE)
    // ========================================================================
    const results = [];

    for (let eq of equivalents) {
        const eq_last4 = await resolveLast4Digits(eq, duty, family);
        const sku = buildSKU(prefix, eq_last4);

        results.push({
            primary: false,
            brand: eq.brand,
            cross: eq.code,
            last4: eq_last4,
            sku,
            family,
            duty,
            media
        });
    }

    // ========================================================================
    // MARCAR PRIMARIO (SIEMPRE EL PRIMERO)
    // ========================================================================
    if (results.length > 0) {
        results[0].primary = true;
    }

    // Guardar auditoría
    homologationDB.saveMultiEquivalence(code, results);

    // Respuesta final
    return jsonBuilder.buildMultiSkuResponse({
        query_norm: code,
        family,
        duty,
        prefix,
        media,
        items: results
    });
}

// ============================================================================
// PROCESO PRINCIPAL
// ============================================================================
async function processCode(input) {
    const normalized = normalizeInput(input);

    const detection = detectionService.detectCodeType(normalized);

    if (detection.type === "SKU") {
        return dataAccess.queryBySKU(normalized);
    }

    if (detection.type === "OEM") {
        const codeObj = await filterProcessor.processFilterCode(normalized);
        return processOEM(codeObj);
    }

    return jsonBuilder.buildErrorResponse({
        query_norm: normalized,
        error: "UNRECOGNIZED_CODE",
        message: "Código no válido."
    });
}

module.exports = {
    processCode
};
