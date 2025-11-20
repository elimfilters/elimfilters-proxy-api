// ============================================================================
// ELIMFILTERS — BUSINESS LOGIC v4.2
// Motor de reglas central: prefijos, duty, familia, last4 y multi-SKU.
// ============================================================================

const rulesProtection = require("./rulesProtection");
const normalizeQuery = require("../utils/normalizeQuery");

// Media por familia
const MEDIA_MAP = {
    OIL: "ELIMTEK",
    FUEL: "ELIMTEK",
    HYDRAULIC: "ELIMTEK",
    AIR: "MACROCORE",
    "AIR DRYER": "MACROCORE",
    CABIN: "MICROKAPPA",
    CARCAZAS: "MACROCORE",
    COOLANT: "ELIMTEK",
    "FUEL SEPARATOR": "ELIMTEK"
};

// Familias por prefijo
const FAMILY_MAP = {
    EA1: "AIR",
    EL8: "OIL",
    EF9: "FUEL",
    EH6: "HYDRAULIC",
    EC1: "CABIN",
    EA2: "CARCAZAS",
    ED4: "AIR DRYER",
    EW7: "COOLANT",
    ES9: "FUEL SEPARATOR",
    EK5: "KITS HD",
    EK6: "KITS LD"
};

// Detecta familia aproximada por Donaldson
function detectFamilyByDonaldson(code = "") {
    const c = String(code).toUpperCase();

    if (/^P[0-9]{5,6}$/.test(c)) return "OIL";
    if (/^P5/.test(c)) return "OIL"; 
    if (/^P1/.test(c)) return "AIR";
    if (/^X/.test(c)) return "FUEL";
    if (/^H/.test(c)) return "HYDRAULIC";

    return "OIL";
}

// Detecta duty
function detectDuty(oemBrand = "") {
    const b = oemBrand.toUpperCase();

    const HD_LIST = [
        "CATERPILLAR", "CAT",
        "KOMATSU",
        "JOHN DEERE",
        "VOLVO", "VOLVO CE",
        "HITACHI",
        "CASE", "CNH",
        "DOOSAN",
        "MACK",
        "SCANIA",
        "MERCEDES-BENZ",
        "ISUZU",
        "HINO",
        "PERKINS",
        "DETROIT DIESEL",
        "MAN"
    ];

    return HD_LIST.includes(b) ? "HD" : "LD";
}

// Prefijo por familia + duty
function getPrefix(family, duty) {
    return rulesProtection.getPrefix(family, duty);
}

// Últimos 4 — aplicando reglas globales
function getLast4(oemCode, manufacturer, duty) {
    const raw = oemCode.replace(/[^A-Z0-9]/g, "");

    if (manufacturer === "DONALDSON") {
        return raw.slice(-4);
    }

    if (manufacturer === "FRAM") {
        return raw.slice(-4);
    }

    return raw.slice(-4);
}

// Genera un SKU único
function buildSKU(prefix, last4) {
    return prefix + last4;
}

// Determina media filtrante
function getMedia(family) {
    return MEDIA_MAP[family] || "ELIMTEK";
}

/**
 * Construye una FILA COMPLETA lista para Google Sheets
 */
function buildMasterRow({
    query_norm,
    sku,
    family,
    duty,
    oem,
    crossList,
    priorityBrand,
    manufacturer,
    last4,
    prefix,
    tech,
    engineApps,
    equipmentApps,
    primary
}) {
    return {
        query_norm,
        sku,
        homologated_sku: sku,

        family,
        duty,
        filter_type: FAMILY_MAP[prefix] || family,
        subtype: "SPIN-ON",

        description: `${family} filter for ${duty} duty applications. Premium media ${getMedia(family)}.`,

        media_type: getMedia(family),

        oem_codes: oem.join(","),
        cross_reference: crossList.join(","),
        priority_reference: primary ? "YES" : "",
        priority_brand_reference: priorityBrand || "",
        
        manufactured_by: manufacturer,
        source: manufacturer,
        last4_source: priorityBrand,
        last4_digits: last4,

        engine_applications: engineApps.join("; "),
        equipment_applications: equipmentApps.join("; "),

        height_mm: tech.height || "",
        outer_diameter_mm: tech.od || "",
        gasket_od_mm: "",
        gasket_id_mm: "",
        thread_size: tech.thread || "",

        micron_rating: tech.micron || "",
        iso_main_efficiency_percent: "",
        iso_test_method: "",
        beta_200: "",
        hydrostatic_burst_psi: "",
        dirt_capacity_grams: "",
        rated_flow_cfm: "",
        rated_flow_gpm: tech.flow || "",

        operating_pressure_min_psi: "",
        operating_pressure_max_psi: "",
        operating_temperature_min_c: "",
        operating_temperature_max_c: "",
        manufacturing_standards: "",
        certification_standards: "",
        fluid_compatibility: "",
        disposal_method: "",
        weight_grams: "",

        review: "",
        all_cross_references: crossList.join(","),

        ok: true
    };
}

module.exports = {
    detectFamilyByDonaldson,
    detectDuty,
    getPrefix,
    getLast4,
    buildSKU,
    getMedia,
    buildMasterRow
};
