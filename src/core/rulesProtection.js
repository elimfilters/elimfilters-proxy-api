// ============================================================================
// ELIMFILTERS — RULES PROTECTION v3.0
// Tabla maestra de familias y prefijos (HD / LD) protegida contra errores
// ============================================================================

/*
 FAMILIAS OFICIALES ELIMFILTERS
 --------------------------------
 - AIR
 - OIL
 - FUEL
 - HYDRAULIC
 - CABIN
 - CARCAZAS (AIR HOUSING)
 - AIR DRYER
 - COOLANT
 - FUEL SEPARATOR
 - KITS HD
 - KITS LD
*/

const RULES = {
    version: "3.0.0",
    lastUpdate: "2025-11-20",

    prefixes: {
        AIR: {
            HD: "EA1",
            LD: "EA1"
        },
        OIL: {
            HD: "EL8",
            LD: "EL8"
        },
        FUEL: {
            HD: "EF9",
            LD: "EF9"
        },
        HYDRAULIC: {
            HD: "EH6",
            LD: null
        },
        CABIN: {
            HD: "EC1",
            LD: "EC1"
        },
        CARCAZAS: {
            HD: "EA2",
            LD: null
        },
        "AIR DRYER": {
            HD: "ED4",
            LD: null
        },
        COOLANT: {
            HD: "EW7",
            LD: null
        },
        "FUEL SEPARATOR": {
            HD: "ES9",
            LD: null
        },
        "KITS HD": {
            HD: "EK5",
            LD: null
        },
        "KITS LD": {
            HD: null,
            LD: "EK6"
        }
    }
};

// Obtiene prefijo válido por familia + duty
function getPrefix(family, duty) {
    if (!family || !duty) return null;

    const fam = String(family).toUpperCase().trim();
    const d = String(duty).toUpperCase().trim();

    if (!RULES.prefixes[fam]) {
        return null;
    }

    return RULES.prefixes[fam][d] || null;
}

module.exports = {
    RULES,
    getPrefix
};
