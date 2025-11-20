// ============================================================================
// ELIMFILTERS — RULES PROTECTION v3.0
// Tabla de prefijos HD/LD + familias + duty
// ============================================================================

const PREFIX_TABLE = {
    AIR:        { HD: "EA1", LD: "EA1" },
    OIL:        { HD: "EL8", LD: "EL8" },
    FUEL:       { HD: "EF9", LD: "EF9" },
    HYDRAULIC:  { HD: "EH6", LD: null  },
    CABIN:      { HD: "EC1", LD: "EC1" },
    CARCAZAS:   { HD: "EA2", LD: null  },
    AIR_DRYER:  { HD: "ED4", LD: null  },
    COOLANT:    { HD: "EW7", LD: null  },
    FUEL_SEP:   { HD: "ES9", LD: null  },
    KITS_HD:    { HD: "EK5", LD: null  },
    KITS_LD:    { HD: null,  LD: "EK6" }
};

// Normalizar nombre familia
function normalizeFamily(fam) {
    if (!fam) return "";
    const f = fam.toUpperCase().trim();

    if (["AIR FILTER", "AIR"].includes(f)) return "AIR";
    if (["OIL", "OIL FILTER", "ENGINE OIL"].includes(f)) return "OIL";
    if (["FUEL", "FUEL FILTER"].includes(f)) return "FUEL";
    if (["HYDRAULIC", "HYD"].includes(f)) return "HYDRAULIC";
    if (["CABIN", "CABIN FILTER"].includes(f)) return "CABIN";
    if (["HOUSING", "CARCAZA", "CARCAZAS"].includes(f)) return "CARCAZAS";
    if (["AIR DRYER", "DRYER"].includes(f)) return "AIR_DRYER";
    if (["COOLANT"].includes(f)) return "COOLANT";
    if (["SEPARATOR", "FUEL SEPARATOR"].includes(f)) return "FUEL_SEP";
    return f;
}

// Obtener prefijo
function getPrefix(family, duty) {
    const fam = normalizeFamily(family);
    const dt = duty?.toUpperCase() === "LD" ? "LD" : "HD";

    if (!PREFIX_TABLE[fam]) return null;
    return PREFIX_TABLE[fam][dt] || null;
}

module.exports = {
    PREFIX_TABLE,
    normalizeFamily,
    getPrefix
};
