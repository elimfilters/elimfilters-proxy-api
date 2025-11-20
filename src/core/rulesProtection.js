// ============================================================================
// ELIMFILTERS — RULES PROTECTION ENGINE v3.0
// Maneja prefijos, familias, duty y reglas de decisión protegidas.
// ============================================================================

// Tabla oficial unificada
const PREFIX_TABLE = {
    AIR:        { HD: "EA1", LD: "EA1" },
    OIL:        { HD: "EL8", LD: "EL8" },
    FUEL:       { HD: "EF9", LD: "EF9" },
    HYDRAULIC:  { HD: "EH6", LD: null },
    CABIN:      { HD: "EC1", LD: "EC1" },
    CARCAZAS:   { HD: "EA2", LD: null },
    AIR_DRYER:  { HD: "ED4", LD: null },
    COOLANT:    { HD: "EW7", LD: null },
    SEPARATOR:  { HD: "ES9", LD: null },
    KITS_HD:    { HD: "EK5", LD: null },
    KITS_LD:    { HD: null, LD: "EK6" },
};

// Familias válidas del motor (normalizadas)
const FAMILY_CANONICAL = {
    AIR: "AIR",
    OIL: "OIL",
    FUEL: "FUEL",
    HYDRAULIC: "HYDRAULIC",
    CABIN: "CABIN",
    CARCAZAS: "CARCAZAS",
    AIR_DRYER: "AIR_DRYER",
    COOLANT: "COOLANT",
    SEPARATOR: "SEPARATOR",
    KITS_HD: "KITS_HD",
    KITS_LD: "KITS_LD"
};

// Normaliza entrada de familia
function normalizeFamily(name) {
    if (!name) return null;
    const n = name.trim().toUpperCase();

    return FAMILY_CANONICAL[n] || null;
}

// Obtiene prefijo según familia + duty
function getPrefix(family, duty) {
    const fam = normalizeFamily(family);
    if (!fam) return null;

    const dutyN = duty?.toUpperCase() === "LD" ? "LD" : "HD";

    const entry = PREFIX_TABLE[fam];
    if (!entry) return null;

    return entry[dutyN] || null;
}

// Para auditorías externas
function getProtectedRules() {
    return {
        version: "3.0",
        lastUpdate: "2025-11-19",
        prefixTable: PREFIX_TABLE,
        familyCanonical: FAMILY_CANONICAL
    };
}

module.exports = {
    normalizeFamily,
    getPrefix,
    getProtectedRules
};
