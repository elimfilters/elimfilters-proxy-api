// ============================================================================
// ELIMFILTERS — FAMILY CLASSIFIER v4.0
// Determina la familia del filtro: AIR, OIL, FUEL, HYDRAULIC, CABIN,
// CARCAZAS, AIR DRYER, COOLANT, FUEL SEPARATOR, KITS HD, KITS LD
// ============================================================================

// ============================================================================
// DICCIONARIOS PRINCIPALES
// ============================================================================

const FAMILY_MAP = {
    AIR: ["AIR", "AIRE", "ELEMENT", "AF", "PA", "CA", "RS", "DONALDSON AIR"],
    OIL: ["OIL", "ACEITE", "LUBE", "LF", "PH", "OIL FILTER"],
    FUEL: ["FUEL", "COMBUSTIBLE", "FF", "PF", "FUEL FILTER"],
    HYDRAULIC: ["HYD", "HYDRAULIC", "HIDRAULICO", "HF"],
    CABIN: ["CABIN", "CABINA", "A/C", "AC", "MICROKAPPA"],
    CARCAZAS: ["HOUSING", "CARCAZA", "AIR HOUSING"],
    AIR_DRYER: ["AIR DRYER", "SECADOR"],
    COOLANT: ["COOLANT", "ANTIFREEZE"],
    FUEL_SEPARATOR: ["SEPARATOR", "WATER SEPARATOR", "SEPARATOR FILTER"],
    KITS_HD: ["KIT HD", "HEAVY KIT", "EK5"],
    KITS_LD: ["KIT LD", "LIGHT KIT", "EK6"]
};

// Palabras que indican tipo HIDRAULICO
const HYD_KEYWORDS = ["HYD", "HYDRAULIC", "HIDRAULICO", "HF"];

// Detecciones por código Donaldson (prefijos)
const DONALDSON_PREFIX_FAMILY = {
    "P5": "FUEL",
    "P55": "FUEL",
    "LF": "OIL",
    "LFP": "OIL",
    "P17": "AIR",
    "EAF": "AIR",
    "X": "HYDRAULIC"
};

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================
function classifyFamily(rawCode, oemBrand = null, donaldsonCross = null) {
    if (!rawCode) return "AIR"; // fallback óptimo

    const code = rawCode.toUpperCase().trim();

    // ------------------------------------------------------------------------
    // 1. Si existe un Donaldson equivalente → usarlo como referencia primaria
    // ------------------------------------------------------------------------
    if (donaldsonCross) {
        const dc = donaldsonCross.toUpperCase().trim();

        // Detectar por prefijos Donaldson (muy confiable)
        for (const prefix in DONALDSON_PREFIX_FAMILY) {
            if (dc.startsWith(prefix)) {
                return DONALDSON_PREFIX_FAMILY[prefix];
            }
        }
    }

    // ------------------------------------------------------------------------
    // 2. Detección por palabras clave (OEM descriptions)
    // ------------------------------------------------------------------------
    for (const family in FAMILY_MAP) {
        const keywords = FAMILY_MAP[family];
        if (keywords.some(k => code.includes(k))) {
            return family;
        }
    }

    // ------------------------------------------------------------------------
    // 3. Detección por patrón del código OEM
    // ------------------------------------------------------------------------
    if (code.includes("-")) {
        const parts = code.split("-");
        if (parts.length >= 2) {
            const middle = parts[1];

            if (/^9\d{2,4}/.test(middle)) return "FUEL";
            if (/^1\d{2,4}/.test(middle)) return "OIL";
            if (/^3\d{2,4}/.test(middle)) return "AIR";
            if (/^5\d{2,4}/.test(middle)) return "HYDRAULIC";
        }
    }

    // ------------------------------------------------------------------------
    // 4. Si el fabricante OEM da una pista
    // ------------------------------------------------------------------------
    if (oemBrand) {
        const b = oemBrand.toUpperCase();

        if (b === "CATERPILLAR" || b === "CAT") {
            // CAT:
            // 1R = OIL
            // 3I = FUEL
            // 4P = HYDRAULIC
            if (code.startsWith("1R")) return "OIL";
            if (code.startsWith("3I") || code.startsWith("3R")) return "FUEL";
            if (code.startsWith("4P")) return "HYDRAULIC";
        }

        if (b === "TOYOTA") {
            // Toyota uses patterns: 17xxxx = AIR, 23xxxx = FUEL, 90xxxx = OIL
            if (code.startsWith("17")) return "AIR";
            if (code.startsWith("23")) return "FUEL";
            if (code.startsWith("90")) return "OIL";
        }
    }

    // ------------------------------------------------------------------------
    // 5. Fallback por heurístico
    // ------------------------------------------------------------------------
    if (HYD_KEYWORDS.some(k => code.includes(k))) return "HYDRAULIC";
    if (code.match(/[AF]\d{3,4}/)) return "AIR";
    if (code.match(/LF|PH|OC/)) return "OIL";

    // ------------------------------------------------------------------------
    // 6. Último fallback seguro
    // ------------------------------------------------------------------------
    return "AIR";
}

module.exports = {
    classifyFamily
};
