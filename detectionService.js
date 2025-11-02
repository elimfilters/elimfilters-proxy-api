// =========================================
// detectionService.js (v3.2.0)
// =========================================

let sheetsInstance = null;

// === Vincular instancia de Google Sheets (si se usa)
function setSheetsInstance(instance) {
  sheetsInstance = instance;
}

// === Fabricantes de motores Heavy Duty y Light Duty
const HD_MANUFACTURERS = [
  "CATERPILLAR", "KOMATSU", "MACK", "VOLVO", "CUMMINS",
  "DETROIT", "PERKINS", "JOHN DEERE", "CASE", "NAVISTAR",
  "SCANIA", "HINO", "ISUZU DIESEL", "MERCEDES DIESEL", "RENAULT DIESEL"
];

const LD_MANUFACTURERS = [
  "TOYOTA", "FORD", "MAZDA", "HONDA", "LEXUS", "NISSAN",
  "CHEVROLET", "HYUNDAI", "KIA", "BMW", "MERCEDES", "AUDI", "VOLKSWAGEN"
];

// === Familias sólidas
const FAMILIES = [
  { name: "AIR", keywords: ["AIR FILTER", "FILTRO DE AIRE", "AIRE", "ELEMENT AIR", "FILTER AIR"], prefix: "EA1" },
  { name: "FUEL", keywords: ["FUEL FILTER", "FILTRO DE COMBUSTIBLE", "COMBUSTIBLE", "DIESEL FILTER"], prefix: "EF9" },
  { name: "OIL", keywords: ["OIL FILTER", "FILTRO DE ACEITE", "ACEITE", "LUBE FILTER"], prefix: "EL8" },
  { name: "CABIN", keywords: ["CABIN FILTER", "FILTRO DE CABINA", "A/C FILTER", "FILTRO A/C"], prefix: "EC1" },
  { name: "SEPARATOR", keywords: ["FUEL WATER SEPARATOR", "SEPARADOR DE COMBUSTIBLE", "SEPARATOR"], prefix: "ES9" },
  { name: "HYDRAULIC", keywords: ["HYDRAULIC FILTER", "FILTRO HIDRAULICO", "HIDRAULICO"], prefix: "EH6" },
  { name: "COOLANT", keywords: ["COOLANT FILTER", "REFRIGERANTE"], prefix: "EW7" },
  { name: "AIR DRYER", keywords: ["AIR DRYER", "SECANTE DE FRENO", "BRAKE DRYER"], prefix: "ED4" },
  { name: "TURBINE", keywords: ["PARKER TURBINE SERIES", "TURBINA", "TURBINE"], prefix: "ET9" },
  { name: "AIR HOUSING", keywords: ["CARCASA PARA FILTRO DE AIRE", "AIR HOUSING"], prefix: "EA2" },
  { name: "KIT DIESEL", keywords: ["KIT DIESEL", "ENGINE DIESEL"], prefix: "EK5" },
  { name: "KIT GASOLINE", keywords: ["KIT GASOLINE", "ENGINE GASOLINA"], prefix: "EK3" }
];

// === Detectar Duty (HD o LD)
function detectDuty(query) {
  const q = query.toUpperCase();

  if (HD_MANUFACTURERS.some(m => q.includes(m))) return "HD";
  if (LD_MANUFACTURERS.some(m => q.includes(m))) return "LD";

  // Detección por contexto si contiene “DIESEL” o “GASOLINE”
  if (q.includes("DIESEL")) return "HD";
  if (q.includes("GASOLINE") || q.includes("GAS")) return "LD";

  return "UNKNOWN";
}

// === Detectar familia (AIR, FUEL, OIL, etc.)
function detectFamily(description) {
  const desc = description ? description.toUpperCase() : "";
  for (const family of FAMILIES) {
    if (family.keywords.some(k => desc.includes(k))) {
      return { name: family.name, prefix: family.prefix };
    }
  }
  return { name: "UNKNOWN", prefix: "XX0" };
}

// === Extraer los últimos 4 dígitos válidos
function extractLast4Digits(str) {
  const digits = (str.match(/\d+/g) || []).join("");
  return digits.slice(-4);
}

// === Verificar fabricante (Donaldson o Fram)
function detectBaseManufacturer(query, duty) {
  const q = query.toUpperCase();

  if (duty === "HD") return "DONALDSON";
  if (duty === "LD") return "FRAM";

  if (q.includes("DONALDSON")) return "DONALDSON";
  if (q.includes("FRAM")) return "FRAM";

  return "GENERIC";
}

// === Generar SKU final
function generateSKU(prefix, reference) {
  const last4 = extractLast4Digits(reference);
  if (!last4 || last4.length < 4) return `${prefix}0000`;
  return `${prefix}${last4}`;
}

// === Detección principal
async function detectFilter(query) {
  try {
    const q = query.toUpperCase();

    // Paso 1: detectar Duty
    const duty = detectDuty(q);

    // Paso 2: detectar familia
    const family = detectFamily(q);

    // Paso 3: determinar fabricante base
    const baseManufacturer = detectBaseManufacturer(q, duty);

    // Paso 4: generar SKU
    const homologated = baseManufacturer === "DONALDSON" || baseManufacturer === "FRAM"
      ? query
      : `${baseManufacturer}-${query}`;

    const finalSku = generateSKU(family.prefix, homologated);

    return {
      status: "OK",
      query: q,
      family: family.name,
      duty,
      source: baseManufacturer,
      homologated_sku: family.prefix,
      final_sku: finalSku
    };
  } catch (err) {
    return { status: "ERROR", message: err.message };
  }
}

module.exports = { setSheetsInstance, detectFilter };
