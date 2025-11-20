// ============================================================================
// ELIMFILTERS — BUSINESS LOGIC v4.2
// Lógica central de decisión: prefijos, familias, duty y generación SKU.
// ============================================================================

const OEM_LIST = require("../../config/oem_list.json");
const detectionService = require("../services/detectionService");

// Familias según criterios EF v4.2
const FAMILY_MAP = {
    AIR: "AIR",
    OIL: "OIL",
    FUEL: "FUEL",
    HYDRAULIC: "HYDRAULIC",
    CABIN: "CABIN",
    HOUSING: "CARCAZA",
    AIR_DRYER: "AIR_DRYER",
    COOLANT: "COOLANT",
    FUEL_SEPARATOR: "FUEL_SEPARATOR",
    KITS_HD: "KITS_HD",
    KITS_LD: "KITS_LD"
};

// Prefijos oficiales EF v4.2
const PREFIX = {
    AIR: "EA1",
    OIL: "EL8",
    FUEL: "EF9",
    HYDRAULIC: "EH6",
    CABIN: "EC1",
    CARCAZA: "EA2",
    AIR_DRYER: "ED4",
    COOLANT: "EW7",
    FUEL_SEPARATOR: "ES9",
    KITS_HD: "EK5",
    KITS_LD: "EK6"
};

// Tipos de media según familia
const MEDIA_BY_FAMILY = {
    AIR: "MACROCORE™",
    OIL: "ELIMTEK™",
    FUEL: "ELIMTEK™",
    HYDRAULIC: "ELIMTEK™",
    CABIN: "MICROKAPPA™",
    CARCAZA: "",
    AIR_DRYER: "",
    COOLANT: "",
    FUEL_SEPARATOR: "ELIMTEK™",
    KITS_HD: "",
    KITS_LD: ""
};

// Detectar si la marca es OEM
function isOEM(brand) {
    return OEM_LIST.includes(brand.trim().toUpperCase());
}

// Determinar duty en base a la marca OEM
function resolveDutyFromOEM(brand) {
    const b = brand.trim().toUpperCase();
    if (b === "TOYOTA" || b === "NISSAN" || b === "HYUNDAI") return "LD";
    return "HD"; // Caterpillar, Komatsu, Volvo, Deere, etc.
}

// --------------------- Generación de SKU base ---------------------

function generateBaseLast4({ brand, family, oemCode, donaldsonCodes = [], framCodes = [] }) {
    const isOEMBrand = isOEM(brand);

    // Caso HD
    if (!isOEMBrand || resolveDutyFromOEM(brand) === "HD") {
        if (donaldsonCodes.length > 0) {
            return donaldsonCodes[0].slice(-4);
        }
        // fallback → últimos 4 del OEM más comercial
        return oemCode.replace(/[^0-9A-Z]/g, "").slice(-4);
    }

    // Caso LD
    if (resolveDutyFromOEM(brand) === "LD") {
        if (framCodes.length > 0) {
            return framCodes[0].slice(-4);
        }
        return oemCode.replace(/[^0-9A-Z]/g, "").slice(-4);
    }

    // Fallback universal
    return oemCode.replace(/[^0-9A-Z]/g, "").slice(-4);
}

// -------------------- Construcción final del SKU -------------------

function generateSKU(family, last4, duty) {
    family = FAMILY_MAP[family] || family.toUpperCase();

    const prefix =
        duty === "LD"
            ? (family === "FUEL" ? "EF9" : PREFIX[family])
            : PREFIX[family];

    return prefix + last4.padStart(4, "0");
}

// -------------------- Media filtrante ------------------------------

function inferMedia(family) {
    family = family.toUpperCase();
    return MEDIA_BY_FAMILY[family] || "";
}

// -------------------- SALIDA PRINCIPAL -----------------------------

function buildFinalProduct({ oemCode, brand, family, duty, donaldsonCodes, framCodes }) {
    const last4 = generateBaseLast4({ brand, family, oemCode, donaldsonCodes, framCodes });
    const sku = generateSKU(family, last4, duty);
    const media = inferMedia(family);

    return {
        sku,
        family,
        duty,
        media_type: media,
        last4_digits: last4,
        last4_source:
            donaldsonCodes.length > 0
                ? "DONALDSON"
                : framCodes.length > 0
                ? "FRAM"
                : "OEM",
        homologated_sku: sku
    };
}

module.exports = {
    buildFinalProduct,
    resolveDutyFromOEM,
    generateBaseLast4,
    generateSKU,
    inferMedia
};
