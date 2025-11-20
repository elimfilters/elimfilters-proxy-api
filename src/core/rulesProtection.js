// ============================================================================
// ELIMFILTERS — RULES PROTECTION v4.0 (OFICIAL)
// Reglas maestras para prefijos, OEM/CROSS, validación de SKU.
// ============================================================================

// ============================================================================
// PREFIJOS OFICIALES
// ============================================================================
const PREFIXES = {
    AIR:           { HD: "EA1", LD: "EA1" },
    OIL:           { HD: "EL8", LD: "EL8" },
    FUEL:          { HD: "EF9", LD: "EF9" }, // ← CORREGIDO: también en LD (tu orden)
    HYDRAULIC:     { HD: "EH6", LD: null },
    CABIN:         { HD: "EC1", LD: "EC1" },
    CARCAZAS:      { HD: "EA2", LD: null },
    AIR_DRYER:     { HD: "ED4", LD: null },
    COOLANT:       { HD: "EW7", LD: null },
    FUEL_SEPARATOR:{ HD: "ES9", LD: null },
    KITS_HD:       { HD: "EK5", LD: null },
    KITS_LD:       { HD: null, LD: "EK6" }
};

// ============================================================================
// OEM LIST OFICIAL
// ============================================================================
const OEM_BRANDS = [
    "CATERPILLAR", "KOMATSU", "TOYOTA", "NISSAN", "JOHN DEERE",
    "FORD", "VOLVO CE", "VOLVO TRUCKS", "KUBOTA", "HITACHI",
    "CASE", "NEW HOLLAND", "CNH", "ISUZU", "HINO", "YANMAR",
    "MITSUBISHI FUSO", "HYUNDAI", "SCANIA", "MERCEDES-BENZ",
    "CUMMINS", "PERKINS", "DOOSAN", "MACK", "MAN", "RENAULT",
    "DEUTZ", "DETROIT DIESEL", "INTERNATIONAL", "NAVISTAR"
];

// ============================================================================
// CROSS / AFTERMARKET LIST OFICIAL
// ============================================================================
const CROSS_BRANDS = [
    "DONALDSON", "FLEETGUARD", "PARKER", "RACOR", "MANN", "MANN+HUMMEL",
    "BALDWIN", "WIX", "FRAM", "HENGST", "MAHLE", "KNECHT",
    "BOSCH", "SAKURA", "LUBER-FINER", "SURE FILTERS",
    "TECFIL", "HENGS", "PREMIUM FILTERS", "MILLAR FILTERS"
];

// ============================================================================
// FUNCIONES DE CLASIFICACIÓN
// ============================================================================
function isOEM(brand) {
    return OEM_BRANDS.includes(brand.toUpperCase());
}

function isCross(brand) {
    return CROSS_BRANDS.includes(brand.toUpperCase());
}

// ============================================================================
// OBTENER PREFIJO SEGÚN FAMILIA + DUTY
// ============================================================================
function getPrefix(family, duty) {
    const fam = PREFIXES[family];
    if (!fam) return null;
    return fam[duty] || null;
}

// ============================================================================
// VALIDACIÓN DE SKU NUEVOS
// ============================================================================
function validateNewSKU(prefix, last4) {
    const sku = `${prefix}${last4}`;
    if (!/^[A-Z0-9]{6,7}$/.test(sku)) {
        throw new Error("INVALID_SKU_FORMAT");
    }
    return sku;
}

module.exports = {
    isOEM,
    isCross,
    getPrefix,
    validateNewSKU
};
