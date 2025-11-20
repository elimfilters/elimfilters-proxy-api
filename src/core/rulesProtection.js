// ============================================================================
// ELIMFILTERS — RULES PROTECTION v4.0
// Valida: OEM vs CROSS, HD vs LD, familia, prefijo correcto y seguridad.
// ============================================================================

// ============================================================================
// LISTA OFICIAL DE OEM (máxima prioridad)
// ============================================================================
const OEM_LIST = [
    "CATERPILLAR", "CAT",
    "KOMATSU",
    "TOYOTA", "NISSAN",
    "JOHN DEERE",
    "FORD",
    "VOLVO CE", "VOLVO TRUCKS",
    "KUBOTA",
    "HITACHI",
    "CASE", "NEW HOLLAND", "CNH",
    "ISUZU",
    "HINO",
    "YANMAR",
    "MITSUBISHI FUSO",
    "HYUNDAI CONSTRUCTION",
    "SCANIA",
    "MERCEDES-BENZ",
    "CUMMINS",      // Solo OEM engine parts
    "PERKINS",
    "DOOSAN",
    "MACK",
    "MAN",
    "RENAULT TRUCKS",
    "DEUTZ",
    "DETROIT DIESEL",
    "INTERNATIONAL", "NAVISTAR"
];

// ============================================================================
// LISTA OFICIAL CROSS / AFTERMARKET
// ============================================================================
const CROSS_LIST = [
    "DONALDSON",       // Premium aftermarket + OEM supplier
    "FLEETGUARD",
    "PARKER", "RACCOR",
    "MANN", "MANN+HUMMEL",
    "BALDWIN",
    "WIX",
    "FRAM",
    "HENGST",
    "MAHLE", "KNECHT",
    "BOSCH",
    "SAKURA",
    "LUBER-FINER",
    "SURE FILTERS",
    "TECfil",
    "PREMIUN FILTERS",
    "MILLAR FILTERS"
];

// ============================================================================
// ASIGNACIÓN OFICIAL DE PREFIJOS
// ============================================================================
const PREFIX_RULES = {
    AIR:        { HD: "EA1", LD: "EA1" },
    OIL:        { HD: "EL8", LD: "EL8" },
    FUEL:       { HD: "EF9", LD: "EF9" },
    HYDRAULIC:  { HD: "EH6", LD: null },
    CABIN:      { HD: "EC1", LD: "EC1" },
    CARCAZA:    { HD: "EA2", LD: null },
    AIR_DRYER:  { HD: "ED4", LD: null },
    COOLANT:    { HD: "EW7", LD: null },
    SEPARATOR:  { HD: "ES9", LD: null },
    KITS_HD:    { HD: "EK5", LD: null },
    KITS_LD:    { HD: null, LD: "EK6" }
};

// ============================================================================
// IDENTIFICAR SI EL CÓDIGO ES OEM
// ============================================================================
function isOEM(brand) {
    return OEM_LIST.includes(brand?.toUpperCase());
}

// ============================================================================
// IDENTIFICAR SI ES CROSS / AFTERMARKET
// ============================================================================
function isCross(brand) {
    return CROSS_LIST.includes(brand?.toUpperCase());
}

// ============================================================================
// OBTENER PREFIJO SEGÚN FAMILIA & DUTY
// ============================================================================
function getPrefix(family, duty) {
    const fam = PREFIX_RULES[family];
    if (!fam) return null;
    return fam[duty] || null;
}

// ============================================================================
// VALIDAR PROTECCIÓN DEL SKU NUEVO
// ============================================================================
function validateNewSKU(prefix, last4) {
    if (!/^[A-Z0-9]{2,3}$/.test(prefix)) {
        throw new Error("INVALID_PREFIX");
    }
    if (!/^\d{4}$/.test(last4)) {
        throw new Error("INVALID_LAST4");
    }
    return `${prefix}${last4}`;
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    isOEM,
    isCross,
    getPrefix,
    validateNewSKU,
    OEM_LIST,
    CROSS_LIST,
    PREFIX_RULES
};
