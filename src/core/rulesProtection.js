// ============================================================================
// ELIMFILTERS — RULES PROTECTION v3.0
// Tabla canónica para prefijos según FAMILY + DUTY
// ============================================================================

const RULES = {
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
        HD: "EH6"
    },
    CABIN: {
        HD: "EC1",
        LD: "EC1"
    },
    CARCAZAS: {
        HD: "EA2"
    },
    AIR_DRYER: {
        HD: "ED4"
    },
    COOLANT: {
        HD: "EW7"
    },
    SEPARATOR: {
        HD: "ES9"
    },
    KITS_HD: {
        HD: "EK5"
    },
    KITS_LD: {
        LD: "EK6"
    }
};

// Obtener prefijo
function getPrefix(family, duty) {
    const fam = String(family || "").toUpperCase().trim();
    const dt = String(duty || "").toUpperCase().trim();

    if (RULES[fam] && RULES[fam][dt]) {
        return RULES[fam][dt];
    }

    return null;
}

// Exponer tabla completa
function getProtectedRules() {
    return {
        version: "3.0",
        lastUpdate: new Date().toISOString(),
        decisionTable: RULES
    };
}

module.exports = {
    getPrefix,
    getProtectedRules
};
