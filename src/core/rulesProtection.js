// ============================================================================
// ELIMFILTERS — RULES PROTECTION ENGINE v3.0
// Valida formatos de códigos, protege integridad del motor y evita SKUs corruptos.
// ============================================================================

/**
 * Reglas de prefijos válidos según familia/duty.
 */
const VALID_PREFIXES = [
    "EL8", // OIL HD/LD
    "EA1", // AIR HD/LD
    "EF9", // FUEL HD/LD
    "EC1", // CABIN HD/LD
    "EH6", // HYDRAULIC HD
    "EA2", // AIR HOUSINGS (Carcazas)
    "ED4", // AIR DRYER
    "EW7", // COOLANT
    "ES9", // FUEL SEPARATOR
    "EK5", // KITS HD
    "EK6"  // KITS LD
];

/**
 * Formatos OEM reconocidos
 */
const OEM_BRANDS = [
    "CAT", "CATERPILLAR",
    "KOMATSU",
    "TOYOTA", "NISSAN",
    "JOHN DEERE",
    "FORD",
    "VOLVO", "VOLVO CE", "VOLVO TRUCKS",
    "KUBOTA",
    "HITACHI",
    "CASE", "CNH", "NEW HOLLAND",
    "ISUZU",
    "HINO",
    "YANMAR",
    "MITSUBISHI", "FUSO",
    "HYUNDAI",
    "SCANIA",
    "MERCEDES",
    "CUMMINS",
    "PERKINS",
    "DOOSAN",
    "MACK",
    "MAN",
    "RENAULT",
    "DEUTZ",
    "DETROIT",
    "INTERNATIONAL"
];

/**
 * Patrones típicos de OEM (numeración extensa)
 */
const OEM_REGEX = /^[A-Z0-9\-]{5,20}$/;

/**
 * CROSS / AFTERMARKET brands
 */
const AFTERMARKET_BRANDS = [
    "DONALDSON",
    "FLEETGUARD",
    "PARKER",
    "RACOR",
    "MANN",
    "BALDWIN",
    "WIX",
    "FRAM",
    "HENGST",
    "MAHLE",
    "KNECHT",
    "BOSCH",
    "SAKURA",
    "LUBER-FINER",
    "TECFIL",
    "HENGS",
    "PREMIUM FILTERS",
    "MILLAR"
];

/**
 * Detecta si un código tiene formato de SKU ELIMFILTERS
 */
function isSKU(code) {
    return VALID_PREFIXES.some(pref => code.startsWith(pref)) && /^[A-Z0-9]{6,10}$/.test(code);
}

/**
 * Detecta si el código parece OEM real
 */
function isOEM(code) {
    if (!OEM_REGEX.test(code)) return false;
    return true;
}

/**
 * Detecta si es CROSS / AFTERMARKET
 */
function isCross(code) {
    // Tiene formato general pero no OEM => aftermarket
    return OEM_REGEX.test(code);
}

/**
 * Detecta anomalías peligrosas
 */
function detectAnomalies(input) {
    const anomalies = [];

    if (input.length < 3) {
        anomalies.push("CODE_TOO_SHORT");
    }
    if (input.length > 30) {
        anomalies.push("CODE_TOO_LONG");
    }
    if (/\s/.test(input)) {
        anomalies.push("CONTAINS_SPACES");
    }
    if (/[^A-Z0-9\-]/.test(input)) {
        anomalies.push("INVALID_CHARACTERS");
    }

    return anomalies;
}

/**
 * Protección general del motor
 */
function validateInput(code) {
    if (!code || typeof code !== "string") {
        return { valid: false, type: "EMPTY", anomalies: ["EMPTY_VALUE"] };
    }

    const normalized = code.trim().toUpperCase();
    const anomalies = detectAnomalies(normalized);

    if (isSKU(normalized)) {
        return { valid: true, type: "SKU", anomalies };
    }

    if (isOEM(normalized)) {
        return { valid: true, type: "OEM", anomalies };
    }

    if (isCross(normalized)) {
        return { valid: true, type: "CROSS", anomalies };
    }

    return { valid: false, type: "UNKNOWN", anomalies };
}

module.exports = {
    validateInput,
    isSKU,
    isOEM,
    isCross,
    VALID_PREFIXES,
    OEM_BRANDS,
    AFTERMARKET_BRANDS
};
