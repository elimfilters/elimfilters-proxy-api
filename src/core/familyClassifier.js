// ============================================================================
// ELIMFILTERS — FAMILY CLASSIFIER v4.0
// Clasifica un código OEM/CROSS en una familia técnica estandarizada.
// ============================================================================

function classifyFamily(oemCode) {
    if (!oemCode) return "OIL";

    const code = oemCode.toUpperCase();

    // AIR FILTER
    if (
        code.includes("AIR") ||
        code.includes("ELEMENT") ||
        code.startsWith("A") ||
        code.includes("-A")
    ) {
        return "AIR";
    }

    // OIL FILTER
    if (
        code.includes("OIL") ||
        code.startsWith("1R") ||
        code.includes("LUBE") ||
        code.startsWith("LF")
    ) {
        return "OIL";
    }

    // FUEL FILTER
    if (
        code.includes("FUEL") ||
        code.startsWith("FF") ||
        code.startsWith("FS") ||
        code.includes("WATER SEPARATOR")
    ) {
        return "FUEL";
    }

    // HYDRAULIC
    if (
        code.includes("HYD") ||
        code.includes("HYDRAULIC") ||
        code.startsWith("H")
    ) {
        return "HYDRAULIC";
    }

    // CABIN FILTERS
    if (
        code.includes("CABIN") ||
        code.includes("AC") ||
        code.includes("HVAC") ||
        code.startsWith("C")
    ) {
        return "CABIN";
    }

    // AIR DRYER
    if (code.includes("DRYER")) {
        return "AIR DRYER";
    }

    // COOLANT FILTERS
    if (code.includes("COOLANT")) {
        return "COOLANT";
    }

    // FUEL SEPARATOR
    if (code.includes("SEPARATOR")) {
        return "FUEL FILTER SEPARATOR";
    }

    // HOUSINGS (Carcazas)
    if (code.includes("HOUSING")) {
        return "CARCAZAS";
    }

    // KITS EQUIPMENT & TRUCKS
    if (code.includes("KIT") || code.includes("SET")) {
        return "KITS";
    }

    return "OIL"; // Default
}

module.exports = {
    classifyFamily
};
