// ============================================================================
// ELIMFILTERS — BUSINESS LOGIC v4.0
// Núcleo que determina FAMILY, DUTY, MEDIA y quién fabrica (OEM vs AFTERMARKET)
// ============================================================================

const OEM_LIST = [
    "CATERPILLAR","CAT","KOMATSU","TOYOTA","NISSAN","JOHN DEERE","FORD","VOLVO",
    "VOLVO CE","VOLVO TRUCKS","KUBOTA","HITACHI","CNH","CASE","NEW HOLLAND",
    "ISUZU","HINO","YANMAR","MITSUBISHI FUSO","HYUNDAI","SCANIA","MERCEDES",
    "CUMMINS","PERKINS","DOOSAN","MACK","MAN","RENAULT TRUCKS","DEUTZ",
    "DETROIT DIESEL","INTERNATIONAL","NAVISTAR"
];

const AFTERMARKET_LIST = [
    "DONALDSON","FLEETGUARD","PARKER","RACOR","MANN","BALDWIN","WIX","FRAM","HENGST",
    "MAHLE","KNECHT","BOSCH","SAKURA","LUBER-FINER","SURE FILTERS","TECFIL",
    "PREMIUM FILTERS","MILLAR FILTERS"
];

// ============================================================================
// DETERMINAR FABRICANTE ORIGINAL (OEM vs AFTERMARKET)
// ============================================================================
function detectBrand(code) {
    const upper = code.toUpperCase();

    // Si comienza con letra + números => Aftermarket probable
    if (/^[A-Z]{1,4}\d{3,6}/.test(upper)) {
        return { type: "AFTERMARKET", brand: detectAftermarketBrand(upper) };
    }

    // Si contiene "-" o "." → OEM típico (CAT 1R-1807, Komatsu 600-211-1234)
    if (upper.includes("-")) {
        return { type: "OEM", brand: detectOEMBrand(upper) };
    }

    return { type: "UNKNOWN", brand: null };
}

function detectOEMBrand(code) {
    const u = code.toUpperCase();
    for (const b of OEM_LIST) {
        if (u.includes(b.replace(/\s+/g, ""))) return b;
    }
    return null;
}

function detectAftermarketBrand(code) {
    const u = code.toUpperCase();
    for (const b of AFTERMARKET_LIST) {
        if (u.includes(b.replace(/\s+/g, ""))) return b;
    }
    return null;
}

// ============================================================================
// DETERMINAR DUTY: HD vs LD
// ============================================================================
function determineDuty(brand) {
    if (!brand) return "HD"; // default seguro

    const LD_BRANDS = ["TOYOTA", "NISSAN", "HYUNDAI", "HINO"];
    if (LD_BRANDS.includes(brand)) return "LD";

    return "HD";
}

// ============================================================================
// DETERMINAR FAMILIA (AIR, OIL, FUEL, ETC.)
// ============================================================================
function determineFamily(code) {
    const u = code.toUpperCase();

    if (u.includes("AIR") && u.includes("DRY")) return "AIR DRYER";
    if (u.includes("COOL")) return "COOLANT";
    if (u.includes("SEP")) return "FUEL SEPARATOR";
    if (u.includes("KIT")) return u.includes("HD") ? "KITS HD" : "KITS LD";

    // Deducción por estructura numérica OEM
    if (/^1R-/.test(u)) return "OIL";               // Ej: CAT 1R-1807 → siempre OIL
    if (/^3E-/.test(u)) return "FUEL";              // Ejemplo Komatsu fuel
    if (/^600-/.test(u)) return "OIL";              // Komatsu oil systems

    // By default:
    if (/^P\d{5,6}/.test(u)) return "FUEL";         // Donaldson tipo P551807
    if (/^L\d{5}/.test(u)) return "OIL";            // Wix / Baldwin tipo Lxxxxx

    // Último fallback: OIL
    return "OIL";
}

// ============================================================================
// SELECCIÓN DEL FABRICANTE PARA OBTENER LOS 4 DÍGITOS BASE
// ============================================================================
function chooseLast4Source(duty, brand, crossList) {
    duty = duty.toUpperCase();

    if (duty === "HD") {
        // Siempre DONALDSON primero
        const don = crossList.find(x => x.brand === "DONALDSON");
        if (don) return { last4: don.part.slice(-4), source: "DONALDSON" };
    }

    if (duty === "LD") {
        // Siempre FRAM primero
        const fram = crossList.find(x => x.brand === "FRAM");
        if (fram) return { last4: fram.part.slice(-4), source: "FRAM" };
    }

    // Si ninguno fabrica → usar OEM más comercial
    const oem = crossList.find(x => x.type === "OEM");
    if (oem) return { last4: oem.part.slice(-4), source: "OEM" };

    // Último recurso: tomar del código
    return { last4: null, source: "UNKNOWN" };
}

// ============================================================================
// SELECCIÓN MEDIA FILTRANTE
// ============================================================================
function determineMediaType(family) {
    const f = family.toUpperCase();

    if (f === "AIR") return "MACROCORE";
    if (f === "CABIN") return "MICROKAPPA";
    return "ELIMTEK"; // OIL, FUEL, HYDRAULIC, COOLANT, SEPARATOR
}

// ============================================================================
// EXPORTAR MOTOR
// ============================================================================
module.exports = {
    detectBrand,
    detectOEMBrand,
    detectAftermarketBrand,
    determineDuty,
    determineFamily,
    chooseLast4Source,
    determineMediaType
};
