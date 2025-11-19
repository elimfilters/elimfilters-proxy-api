// ============================================================================
// ELIMFILTERS — BUSINESS LOGIC ENGINE v3.0
// Lógica comercial oficial de generación de SKU y metadatos
// ============================================================================

const rulesProtection = require("./rulesProtection");
const dataAccess = require("../services/dataAccess");

// Marcas OEM oficiales
const OEM_BRANDS = [
  "CATERPILLAR","CAT","KOMATSU","TOYOTA","NISSAN","JOHN DEERE","DEERE",
  "FORD","VOLVO","KUBOTA","HITACHI","CNH","CASE","NEW HOLLAND",
  "ISUZU","HINO","YANMAR","FUSO","HYUNDAI","SCANIA","MERCEDES",
  "CUMMINS","PERKINS","DOOSAN","MACK","MAN","RENAULT","DEUTZ",
  "DETROIT","INTERNATIONAL"
];

// Aftermarket premium
const AFTERMARKET = [
  "DONALDSON","FLEETGUARD","PARKER","RACOR","MANN","BALDWIN",
  "WIX","FRAM","HENGST","MAHLE","BOSCH","SAKURA","LUBER-FINER"
];

// Media oficial
const MEDIA = {
  OIL: "ELIMTEK™",
  FUEL: "ELIMTEK™",
  HYDRAULIC: "ELIMTEK™",
  AIR: "MACROCORE™",
  CABIN: "MICROKAPPA™",
  AIR_DRYER: "ELIMTEK™",
  COOLANT: "ELIMTEK™"
};

// Subtipos
const SUBTYPE = {
  OIL: "SPIN-ON",
  FUEL: "SPIN-ON",
  HYDRAULIC: "SPIN-ON",
  AIR: "PRIMARY ELEMENT",
  CABIN: "PANEL",
  AIR_DRYER: "SPIN-ON",
  COOLANT: "SPIN-ON"
};

// =====================================================================================
// NORMALIZAR CONSULTA
// =====================================================================================
function normalize(code) {
  return String(code || "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\-\/]/g, "");
}

// =====================================================================================
// DETERMINAR SI ES OEM
// =====================================================================================
function isOEM(brand) {
  if (!brand) return false;
  const b = brand.toUpperCase();
  return OEM_BRANDS.includes(b);
}

// =====================================================================================
// ASIGNAR FAMILIA A PARTIR DE EQUIVALENTE (Donaldson/Fram) O OEM
// =====================================================================================
function detectFamily(description = "", brand = "") {
  const text = `${description} ${brand}`.toUpperCase();

  if (text.includes("AIR") || text.includes("FILTER AIR")) return "AIR";
  if (text.includes("OIL")) return "OIL";
  if (text.includes("FUEL")) return "FUEL";
  if (text.includes("HYD")) return "HYDRAULIC";
  if (text.includes("CAB")) return "CABIN";
  if (text.includes("COOL")) return "COOLANT";
  if (text.includes("DRYER")) return "AIR_DRYER";

  return "OIL"; // fallback seguro
}

// =====================================================================================
// REGLA FINAL PARA DUTY
// =====================================================================================
function detectDuty(brand) {
  if (!brand) return "HD";

  const b = brand.toUpperCase();

  // Toyota, Nissan, Honda, Hyundai → LD
  if (["TOYOTA","NISSAN","HONDA","HYUNDAI","KIA","MAZDA"].includes(b)) {
    return "LD";
  }

  return "HD"; // default
}

// =====================================================================================
// GENERAR ÚLTIMOS 4 DIGITOS
// =====================================================================================
async function generateLast4(oemCode, duty, donEquivalent, framEquivalent) {
  // 1. Prioridad Donaldson para HD
  if (duty === "HD" && donEquivalent) {
    const match = donEquivalent.match(/\d{4}$/);
    if (match) return match[0];
  }

  // 2. Prioridad FRAM para LD
  if (duty === "LD" && framEquivalent) {
    const match = framEquivalent.match(/\d{4}$/);
    if (match) return match[0];
  }

  // 3. Si ninguno fabrica → usar los últimos 4 del OEM
  const oemMatch = oemCode.match(/\d{4}$/);
  if (oemMatch) return oemMatch[0];

  return "0000";
}

// =====================================================================================
// CONSTRUIR SKU FINAL
// =====================================================================================
function buildSKU(family, duty, last4) {
  const prefix = rulesProtection.getPrefix(family, duty);
  return `${prefix}${last4}`;
}

// =====================================================================================
// EXPORT: FUNCIÓN PRINCIPAL
// =====================================================================================
async function buildFinalRecord({ query, brand, description, don, fram, oemCodes = [], crossRefs = [] }) {
  const norm = normalize(query);

  // Familia
  const family = detectFamily(description, brand);

  // Duty
  const duty = detectDuty(brand);

  // Últimos 4
  const last4 = await generateLast4(norm, duty, don, fram);

  // SKU final
  const sku = buildSKU(family, duty, last4);

  // Media
  const media_type = MEDIA[family] || "ELIMTEK™";

  // Subtipo
  const subtype = SUBTYPE[family] || "SPIN-ON";

  return {
    query_norm: norm,
    sku,
    family,
    duty,
    media_type,
    filter_type: `${family} FILTER`,
    subtype,
    oem_codes: oemCodes.slice(0, 10).join(","),
    cross_reference: crossRefs.slice(0, 10).join(","),
    manufactured_by: brand || "",
    last4_source: duty === "HD" ? "DONALDSON" : "FRAM",
    last4_digits: last4,
    source: "ENGINE",
    homologated_sku: sku
  };
}

module.exports = {
  buildFinalRecord,
  normalize
};
