// ============================================================================
// ELIMFILTERS - DETECTION SERVICE (FINAL VERSION)
// Clasificación del código, detección OEM/Aftermarket, familia y fabricante
// ============================================================================

const normalize = (code) =>
  String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9\-]/g, "");

// ============================================================================
// LISTAS OFICIALES
// ============================================================================

// OEM reales (fabricantes)
const OEM_BRANDS = [
  "CATERPILLAR", "CAT",
  "KOMATSU",
  "TOYOTA", "NISSAN",
  "JOHNDEERE", "DEERE",
  "VOLVO", "VOLVOCE", "VOLVOTRUCKS",
  "KUBOTA",
  "HITACHI",
  "CNH", "CASE", "NEWHOLLAND",
  "ISUZU", "HINO", "YANMAR",
  "MITSUBISHIFUSO",
  "HYUNDAI",
  "SCANIA",
  "MERCEDES", "MERCEDESBENZ",
  "CUMMINS",     // OEM engine parts ONLY (no Fleetguard)
  "PERKINS",
  "DOOSAN",
  "MACK", "MAN", "RENAULTTRUCKS",
  "DEUTZ",
  "DETROITDIESEL",
  "INTERNATIONAL", "NAVISTAR",
];

// Aftermarket / cross references
const AFTERMARKET_BRANDS = [
  "DONALDSON",
  "FLEETGUARD",
  "PARKER", "RACOR",
  "MANN", "MANNHUMMEL",
  "BALDWIN",
  "WIX",
  "FRAM",
  "HENGST",
  "MAHLE", "KNECHT",
  "BOSCH",
  "SAKURA",
  "LUBERFINER", "SUREFILTERS",
  "TECFIL",
  "PREMIUMFILTERS",
  "MILLAR"
];

// ============================================================================
// DETECCIÓN DE MARCA
// ============================================================================

function detectBrand(code) {
  const c = normalize(code);

  // Detectar si empieza con típicos OEM
  if (/^(1R|6I|7C|9X|326|471|3E|4N|5P|6Y|7W|8C|9M)/.test(c)) return "CATERPILLAR";
  if (/^(600|613|674|786)/.test(c)) return "KOMATSU";
  if (/^(23390|17801|04152|15601)/.test(c)) return "TOYOTA";
  if (/^(15208|16546|22690)/.test(c)) return "NISSAN";
  if (/^(RE|AR|AT|DZ|TY)/.test(c)) return "JOHNDEERE";

  // Donaldson codes
  if (/^P\d{5,6}$/.test(c)) return "DONALDSON";

  // Fleetguard
  if (/^[A-Z]{1,3}\d{3,6}$/.test(c) && /^(LF|HF|FF|AF)/.test(c)) return "FLEETGUARD";

  return "UNKNOWN";
}

// ============================================================================
// CLASIFICACIÓN DEL CÓDIGO
// ============================================================================

function detectCodeType(code) {
  const c = normalize(code);

  // SKU interno de ELIMFILTERS
  if (/^(EA1|EA2|EL8|EF9|EH6|EC1|ED4|EW7|ES9|EK5|EK6)\d{4}$/.test(c)) {
    return { type: "SKU" };
  }

  // OEM: deben ser códigos de fabricantes reales
  const brand = detectBrand(c);
  if (OEM_BRANDS.includes(brand)) return { type: "OEM", brand };

  // Aftermarket
  if (AFTERMARKET_BRANDS.includes(brand)) {
    return { type: "AFTERMARKET", brand };
  }

  // Si el código es puro número o guiones, lo consideramos OEM
  if (/^[0-9\-]{4,}$/.test(c)) return { type: "OEM", brand: "UNKNOWN" };

  return { type: "UNKNOWN" };
}

// ============================================================================
// DETECCIÓN DE FAMILIA POR HEURÍSTICA
// ============================================================================

function detectFamily(code) {
  const c = normalize(code);

  if (/^P5/.test(c) || /^LF/.test(c)) return "OIL";
  if (/^FF|FS/.test(c)) return "FUEL";
  if (/^AF/.test(c)) return "AIR";
  if (/^HF/.test(c)) return "HYDRAULIC";

  return "OIL"; // fallback seguro
}

// ============================================================================
// PRIORIDAD DE NÚMEROS PARA GENERAR LOS 4 DÍGITOS BASE
// ============================================================================
// HD = Donaldson
// LD = FRAM
// OEM si no existe Donaldson/Fram
// OEM más comercial si existen múltiples

function pickLast4Digits({ duty, donaldsonList, framList, oemList }) {

  // HD → Donaldson primero
  if (duty === "HD") {
    if (donaldsonList.length > 0) {
      return donaldsonList[0].slice(-4);
    }
    return oemList[0].slice(-4);
  }

  // LD → FRAM primero
  if (duty === "LD") {
    if (framList.length > 0) {
      return framList[0].slice(-4);
    }
    return oemList[0].slice(-4);
  }

  return oemList[0].slice(-4);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  normalize,
  detectBrand,
  detectCodeType,
  detectFamily,
  pickLast4Digits
};
