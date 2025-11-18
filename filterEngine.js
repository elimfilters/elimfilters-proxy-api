// filterEngine.js – v4.0.0
// NÚCLEO OFICIAL DEL SISTEMA DE HOMOLOGACIÓN ELIMFILTERS
// (Clasificación + Normalización + Family Rules + Duty + Base Brand + SKU Final)

const rulesProtection = require('./rulesProtection');
const businessLogic = require('./businessLogic');

// ============================================================================
// 1. Normalización del código
// ============================================================================
function normalizeCode(code) {
    if (!code) return "";
    return code.trim().toUpperCase();
}

// ============================================================================
// 2. Identificar DUTY automáticamente (HD o LD)
// ============================================================================
function detectDuty(code) {
    const c = code.toUpperCase();

    // HD (Heavy Duty)
    const heavyDutyPatterns = [
        /^LF/, /^FF/, /^FS/, /^WF/, /^HF/,
        /^P5/, /^DBL/, /^DONALDSON/, /^CAT/, /^CATERPILLAR/,
        /^R\d+/, /TURBINE/, /SEPARATOR/, /HYDRAULIC/, /DRYER/
    ];

    if (heavyDutyPatterns.some(r => r.test(c))) return "HD";

    // LD (Automotriz)
    const lightPatterns = [
        /^PH/, /^CA/, /^CH/, /^CF/, /^TOYOTA/, /^HONDA/,
        /^\d{5,}$/, /CABIN/, /A\/C/
    ];

    if (lightPatterns.some(r => r.test(c))) return "LD";

    // Default – si no se puede determinar
    return "HD"; // Por seguridad, se trata como HD
}

// ============================================================================
// 3. Identificar familia del filtro (OIL, FUEL, AIR, CABIN, etc.)
// ============================================================================
function detectFamily(code) {
    const c = code.toUpperCase();

    if (/LF|PH|P55|OIL|ENGINE/.test(c)) return "OIL";
    if (/FF|FS|FUEL|DIESEL/.test(c)) return "FUEL";
    if (/AF|AIR FILTER|AIR /.test(c)) return "AIR";
    if (/CABIN|A\/C|CF|87139/.test(c)) return "CABIN";
    if (/SEPARATOR|WATER/.test(c)) return "FUEL SEPARATOR";
    if (/HF|HYDRAULIC/.test(c)) return "HYDRAULIC";
    if (/WF|COOLANT/.test(c)) return "COOLANT";
    if (/DRYER|AD-/.test(c)) return "AIR DRYER";
    if (/HOUSING|CARCAZA/.test(c)) return "CARCAZA";
    if (/TURBINE|R\d+/.test(c)) return "TURBINE";

    // Kits automotrices y pesados
    if (/KIT/.test(c)) {
        const duty = detectDuty(c);
        if (duty === "HD") return "KITS HD";
        return "KITS LD";
    }

    return null;
}

// ============================================================================
// 4. Identificar la marca base (Donaldson | Fram)
// ============================================================================
function detectBaseBrand(family, duty) {
    if (!family || !duty) return null;

    // Reglas estrictas
    if (family === "OIL") {
        return duty === "HD" ? "DONALDSON" : "FRAM";
    }

    if (family === "CABIN") return "FRAM";

    // TODAS las demás familias HD usan DONALDSON
    return "DONALDSON";
}

// ============================================================================
// 5. Extraer últimos 4 números del OEM HOMOLOGADO
// ============================================================================
function extractLast4(oem) {
    return businessLogic.getLast4Digits(oem);
}

// ============================================================================
// 6. Generar SKU COMPLETO con reglas oficiales
// ============================================================================
function generateElimfiltersSKU(family, duty, homologatedCode) {
    return businessLogic.generateSKU({
        family,
        duty,
        oem_code: homologatedCode
    });
}

// ============================================================================
// 7. ORQUESTACIÓN COMPLETA (sin BD)
//    → Esta función arma TODO excepto la homologación del OEM
// ============================================================================
function processLocal(code, homologatedOEM) {
    const normalized = normalizeCode(code);

    const family = detectFamily(normalized);
    const duty = detectDuty(normalized);
    const baseBrand = detectBaseBrand(family, duty);

    if (!family) {
        return {
            ok: false,
            error: "UNRECOGNIZED_FAMILY",
            message: `No se pudo determinar la familia del filtro para '${normalized}'.`
        };
    }

    // SKU final usando el OEM homologado
    const skuObj = generateElimfiltersSKU(family, duty, homologatedOEM);

    return {
        ok: true,
        query: normalized,
        family,
        duty,
        baseBrand,
        homologatedOEM,
        prefix: skuObj.prefix,
        last4: skuObj.last4,
        sku: skuObj.sku,
        rule: skuObj.rule,
        version: skuObj.version
    };
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    normalizeCode,
    detectDuty,
    detectFamily,
    detectBaseBrand,
    extractLast4,
    generateElimfiltersSKU,
    processLocal
};
