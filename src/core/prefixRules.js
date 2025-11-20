// ============================================================================
// ELIMFILTERS — PREFIX RULES v4.0
// Devuelve el prefijo correcto según FAMILY y DUTY
// ============================================================================

const PREFIX_TABLE = {
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
        LD: "EH6" // LD casi no existe pero se homologa
    },
    CABIN: {
        HD: "EC1",
        LD: "EC1"
    },
    CARCAZAS: {
        HD: "EA2",
        LD: "EA2"
    },
    AIR_DRYER: {
        HD: "ED4",
        LD: "ED4"
    },
    COOLANT: {
        HD: "EW7",
        LD: "EW7"
    },
    FUEL_SEPARATOR: {
        HD: "ES9",
        LD: "ES9"
    },
    KITS_HD: {
        HD: "EK5",
        LD: "EK5"
    },
    KITS_LD: {
        HD: "EK6",
        LD: "EK6"
    }
};

/**
 * Retorna prefijo según la familia y duty.
 * Si no existe combinación exacta, fallback a AIR → EA1
 */
function getPrefix(family, duty) {
    const fam = String(family || "").toUpperCase().trim();
    const dt = String(duty || "").toUpperCase().trim();

    if (PREFIX_TABLE[fam] && PREFIX_TABLE[fam][dt]) {
        return PREFIX_TABLE[fam][dt];
    }

    // Fallback seguro
    return "EA1";
}

module.exports = {
    getPrefix,
    PREFIX_TABLE
};
