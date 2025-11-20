// ============================================================================
// ELIMFILTERS — detectionService.js
// Detecta tipo de código, familia, duty y fuente (OEM / Aftermarket / SKU).
// ============================================================================

// LISTA OFICIAL OEM (HD + LD)
const OEM_MANUFACTURERS = [
    "CATERPILLAR", "CAT",
    "KOMATSU",
    "TOYOTA", "NISSAN",
    "JOHN DEERE",
    "FORD",
    "VOLVO", "VOLVO CE", "VOLVO TRUCKS",
    "KUBOTA",
    "HITACHI",
    "CASE", "NEW HOLLAND", "CNH",
    "ISUZU",
    "HINO",
    "YANMAR",
    "MITSUBISHI FUSO",
    "HYUNDAI CONSTRUCTION",
    "SCANIA",
    "MERCEDES-BENZ", "MERCEDES",
    "CUMMINS",
    "PERKINS",
    "DOOSAN",
    "MACK",
    "MAN",
    "RENAULT TRUCKS",
    "DEUTZ",
    "DETROIT DIESEL",
    "INTERNATIONAL", "NAVISTAR"
];

// LISTA OFICIAL DE AFTERMARKET / CROSS REFERENCE
const AFTERMARKET_BRANDS = [
    "DONALDSON",
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
    "LUBER-FINER", "SURE FILTERS",
    "TECfil", "PREMIUM FILTERS", "MILLAR", "HENGS"
];

// TABLA DE FAMILIAS (TU TABLA FINAL)
const FAMILY_TABLE = {
    AIR:       { HD: "EA1", LD: "EA1" },
    OIL:       { HD: "EL8", LD: "EL8" },
    FUEL:      { HD: "EF9", LD: "EF9" },
    HYDRAULIC: { HD: "EH6" },
    CABIN:     { HD: "EC1", LD: "EC1" },
    CARCAZAS:  { HD: "EA2" },
    "AIR DRYER": { HD: "ED4" },
    COOLANT:   { HD: "EW7" },
    "FUEL SEPARATOR": { HD: "ES9" },
    "KITS HD": { HD: "EK5" },
    "KITS LD": { LD: "EK6" }
};

// DETECTA SI ES SKU DIRECTO (EL8xxxx, EF9xxxx, etc.)
function isSKU(code) {
    return /^[A-Z]{2,3}\d{4}$/.test(code);
}

// NORMALIZA CÓDIGO
function normalize(code) {
    return code.trim().toUpperCase().replace(/\s+/g, "");
}

// DETERMINAR DUTY SEGÚN FABRICANTE OEM
function detectDutyFromManufacturer(brand) {
    const HD_BRANDS = [
        "CATERPILLAR","CAT","KOMATSU","JOHN DEERE","VOLVO","VOLVO CE","VOLVO TRUCKS",
        "HITACHI","CASE","NEW HOLLAND","CNH","ISUZU","HINO","YANMAR","MITSUBISHI FUSO",
        "HYUNDAI CONSTRUCTION","SCANIA","MACK","MAN","RENAULT TRUCKS","DETROIT DIESEL",
        "DOOSAN","DEUTZ","INTERNATIONAL","NAVISTAR"
    ];

    const LD_BRANDS = [
        "TOYOTA","NISSAN","FORD","KUBOTA","MERCEDES","MERCEDES-BENZ","CUMMINS","PERKINS"
    ];

    if (HD_BRANDS.includes(brand)) return "HD";
    if (LD_BRANDS.includes(brand)) return "LD";

    return "HD"; // DEFAULT
}

// DETERMINA FAMILIA POR PATRONES DE CÓDIGO OEM
function detectFamilyByCode(code) {
    if (code.includes("AIR") || code.includes("A/")) return "AIR";
    if (code.includes("OIL") || code.includes("LUB")) return "OIL";
    if (code.includes("FUEL") || code.includes("FS") || code.includes("RACOR")) return "FUEL";
    if (code.includes("HYD")) return "HYDRAULIC";
    if (code.includes("CAB")) return "CABIN";
    return "OIL"; // fallback más común
}

// EXPORTADO: FUNCIÓN PRINCIPAL
function detectCodeType(input) {
    const code = normalize(input);

    // 1. SKU DIRECTO
    if (isSKU(code)) {
        return {
            type: "SKU",
            source_type: "SKU",
            code,
            family: null,
            duty: null
        };
    }

    // 2. OEM
    const brandFragment = code.split(/[- ]/)[0];

    if (OEM_MANUFACTURERS.includes(brandFragment)) {
        const duty = detectDutyFromManufacturer(brandFragment);
        const family = detectFamilyByCode(code);

        return {
            type: "OEM",
            source_type: "OEM",
            code,
            family,
            duty
        };
    }

    // 3. AFTERMARKET / CROSS
    if (AFTERMARKET_BRANDS.includes(brandFragment)) {
        return {
            type: "OEM", // se procesa igual en filterProcessor
            source_type: "AFTERMARKET",
            code,
            family: detectFamilyByCode(code),
            duty: "HD"
        };
    }

    // 4. SI NO COINCIDE → OEM genérico
    return {
        type: "OEM",
        source_type: "OEM",
        code,
        family: detectFamilyByCode(code),
        duty: "HD"
    };
}

module.exports = {
    detectCodeType,
    FAMILY_TABLE,
    OEM_MANUFACTURERS,
    AFTERMARKET_BRANDS
};
