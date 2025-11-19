// ============================================================================
// ELIMFILTERS — DETECTION SERVICE v3.0
// Lógica de identificación OEM / AFTERMARKET / SKU + familia + duty
// ============================================================================

// ------------------------------------------------------
// LISTA OFICIAL DE OEM (Fabricantes reales)
// ------------------------------------------------------
const OEM_BRANDS = [
  "CATERPILLAR", "CAT",
  "KOMATSU",
  "TOYOTA", "NISSAN",
  "JOHN DEERE",
  "FORD",
  "VOLVO", "VOLVO CE", "VOLVO TRUCKS",
  "KUBOTA",
  "HITACHI",
  "CASE", "NEW HOLLAND", "CNH",
  "ISUZU", "HINO",
  "YANMAR",
  "MITSUBISHI FUSO",
  "HYUNDAI",
  "SCANIA",
  "MERCEDES",
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

// ------------------------------------------------------
// LISTA OFICIAL DE AFTERMARKET / CROSS BRANDS
// ------------------------------------------------------
const AFTERMARKET_BRANDS = [
  "DONALDSON",
  "FLEETGUARD",
  "PARKER", "RACOR",
  "MANN", "MANN+HUMMEL",
  "BALDWIN",
  "WIX",
  "FRAM",
  "HENGST",
  "MAHLE", "KNECHT",
  "BOSCH",
  "SAKURA",
  "LUBER-FINER", "SURE FILTERS",
  "TECFIL", "PREMIUM FILTERS",
  "HENGS", "MILLAR FILTERS"
];

// ------------------------------------------------------
// DETECCIÓN TIPO DE CÓDIGO (OEM / CROSS / SKU)
// ------------------------------------------------------
function detectCodeType(code) {
  code = String(code).trim().toUpperCase();

  // SKU ELIMFILTERS directo
  if (/^(EL|EF|EA|EH|EC|ED|EW|ES|EK)\d{4}$/i.test(code)) {
    return { type: "SKU" };
  }

  // Donaldson
  if (/^P\d{5,6}$/i.test(code)) return { type: "AFTERMARKET", brand: "DONALDSON" };

  // Fleetguard
  if (/^(LF|AF|FF|HF)\d{3,6}$/i.test(code)) return { type: "AFTERMARKET", brand: "FLEETGUARD" };

  // FRAM
  if (/^(PH|CA|FA)\d{3,6}$/i.test(code)) return { type: "AFTERMARKET", brand: "FRAM" };

  // OEM con guiones CAT 1R-1807
  if (/^[A-Z0-9]{2,3}-?\d{3,5}$/i.test(code)) {
    return { type: "OEM" };
  }

  // OEM largos Toyota 23390-0L041
  if (/^\d{4,6}-?[A-Z0-9]{3,5}$/i.test(code)) {
    return { type: "OEM" };
  }

  // Si no encaja
  return { type: "UNKNOWN" };
}

// ------------------------------------------------------
// DETERMINAR FAMILIA (AIR / OIL / FUEL / HYDRAULIC / CABIN / AIR DRYER, ETC.)
// ------------------------------------------------------
function detectFamily(code) {
  code = String(code).toUpperCase();

  if (/^1R-?07|^3I|^8N|^7W/i.test(code)) return "OIL";
  if (/^1R-?07|^326|^233|^1780/i.test(code)) return "FUEL";
  if (/^17801|^17220|^AF|^CA/i.test(code)) return "AIR";
  if (/^HC|^HF|^P56/i.test(code)) return "HYDRAULIC";
  if (/^87139|^CF|^MICROKAPPA/i.test(code)) return "CABIN";

  return "OIL"; // fallback
}

// ------------------------------------------------------
// DETECTAR DUTY LEVEL (HD O LD)
// ------------------------------------------------------
function detectDuty(code) {
  code = code.toUpperCase();

  // Reglas simples:
  if (code.startsWith("1R") || code.startsWith("P") || code.startsWith("LF") || code.startsWith("FF"))
    return "HD";

  // Toyota / Nissan / Automotive
  if (/^17|^87139|^CA|^PH|\d{5}-/.test(code)) return "LD";

  return "HD";
}

// ------------------------------------------------------
// DETECTAR MARCA BASE (OEM / CROSS)
// ------------------------------------------------------
function detectBrandByPattern(code) {
  code = code.toUpperCase();

  // Donaldson
  if (/^P\d{5,6}$/i.test(code)) return "DONALDSON";

  // Fleetguard
  if (/^(LF|AF|FF|HF)\d+/i.test(code)) return "FLEETGUARD";

  // FRAM
  if (/^(PH|CA|FA)\d+/i.test(code)) return "FRAM";

  return null;
}

// ------------------------------------------------------
// GENERAR ÚLTIMOS 4 DÍGITOS BASE
// ------------------------------------------------------
// REGLA FINAL OFICIAL:
//
// HD → buscar primero DONALDSON. Si NO lo fabrica → usar últimos 4 del OEM más comercial.
// LD → buscar primero FRAM. Si NO lo fabrica → usar últimos 4 del OEM.
// ------------------------------------------------------
function generateLast4({ code, duty, crossFound }) {
  // Si el cross existe (solo Donaldson HD o FRAM LD), USAR SUS 4 DÍGITOS
  if (crossFound && crossFound.length === 4) return crossFound;

  // Si no existe cross → usar últimos 4 del OEM
  return code.replace(/[^A-Z0-9]/g, "").slice(-4);
}

// ------------------------------------------------------
// PREFIJO
// ------------------------------------------------------
function detectPrefix(family, duty) {
  family = String(family).toUpperCase();
  duty = String(duty).toUpperCase();

  const map = {
    "AIR_HD": "EA1",
    "AIR_LD": "EA1",
    "OIL_HD": "EL8",
    "OIL_LD": "EL8",
    "FUEL_HD": "EF9",
    "FUEL_LD": "EF9",
    "HYDRAULIC_HD": "EH6",
    "CABIN_LD": "EC1",
    "CABIN_HD": "EC1",
    "AIR DRYER_HD": "ED4",
    "COOLANT_HD": "EW7",
    "FUEL FILTER SEPARATOR_HD": "ES9",
    "CARCAZAS HD": "EA2",
    "KITS HD": "EK5",
    "KITS LD": "EK6"
  };

  return map[`${family}_${duty}`] || "EL8";
}

// ------------------------------------------------------
// MEDIA FILTRANTE
// ------------------------------------------------------
function detectMediaType(family) {
  family = family.toUpperCase();

  if (family === "OIL" || family === "FUEL" || family === "HYDRAULIC") return "ELIMTEK™";
  if (family === "AIR") return "MACROCORE™";
  if (family === "CABIN") return "MICROKAPPA™";

  return "ELIMTEK™";
}

// ------------------------------------------------------
// API PRINCIPAL PARA EL MOTOR
// ------------------------------------------------------
async function analyzeCode(code) {
  const type = detectCodeType(code);
  const family = detectFamily(code);
  const duty = detectDuty(code);
  const prefix = detectPrefix(family, duty);
  const media_type = detectMediaType(family);

  // Simulación de cross
  let crossLast4 = null;

  // --- Regla HD primero Donaldson ---
  if (duty === "HD") {
    if (family === "OIL" && /^P55/.test(code)) crossLast4 = code.slice(-4);
    if (family === "FUEL" && /^P55/.test(code)) crossLast4 = code.slice(-4);
  }

  // --- Regla LD primero FRAM ---
  if (duty === "LD") {
    if (family === "AIR" && /^CA/i.test(code)) crossLast4 = code.slice(-4);
    if (family === "OIL" && /^PH/i.test(code)) crossLast4 = code.slice(-4);
  }

  const last4 = generateLast4({ code, duty, crossFound: crossLast4 });
  const sku = `${prefix}${last4}`;

  return {
    query_norm: code.toUpperCase(),
    sku,
    family,
    duty,
    prefix,
    last4_digits: last4,
    media_type,
    filter_type: family === "AIR" ? "Air Filter" :
                  family === "CABIN" ? "Cabin Filter" :
                  "Oil Filter",
    subtype: family === "AIR" ? "Carcaza para filtros de aire" :
             family === "CABIN" ? "Cabin Panel" :
             "Spin-On",
    manufactured_by: null,
    source: "ENGINE_V3"
  };
}

// ------------------------------------------------------
module.exports = {
  detectCodeType,
  detectFamily,
  detectDuty,
  detectPrefix,
  detectMediaType,
  analyzeCode
};
