/**
 * ELIMFILTERS detectionService v3.3.4
 * Lógica integral de detección de familia, duty, prefijos y generación de SKU técnico.
 */

let sheetsInstance = null;

function setSheetsInstance(instance) {
  sheetsInstance = instance;
  console.log('✅ Detection Service vinculado con Google Sheets');
}

// ============================
// FAMILIAS Y PREFIJOS BASE
// ============================
const FAMILY_RULES = {
  AIR: { keywords: ["AIR", "AIRE", "CA", "CF", "RS", "P1", "EAF"], prefix: "EA1" },
  OIL: { keywords: ["OIL", "ACEITE", "LUBE", "LUBRICANTE", "1R", "LF", "PH", "B ", "BT"], prefix: "EL8" },
  HYDRAULIC: { keywords: ["HYDRAULIC", "HIDRAULICO", "HF", "HH"], prefix: "EH6" },
  SEPARATOR: { keywords: ["SEPARATOR", "SEPARADOR", "COALESCER", "COALESCENTE", "PS"], prefix: "ES9" },
  COOLANT: { keywords: ["COOLANT", "REFRIGERANTE", "WF"], prefix: "EW7" },
  CABIN: { keywords: ["CABIN", "CABINA", "AC", "A/C", "HVAC"], prefix: "EC1" },
  AIR_DRYER: { keywords: ["AIR DRYER", "SECANTE", "BRAKE", "ED"], prefix: "ED4" },
  TURBINE: { keywords: ["TURBINE", "TURBINA", "PARKER TURBINE SERIES"], prefix: "ET9" },
  HOUSING: { keywords: ["CARCASA", "HOUSING"], prefix: "EA2" },
  KIT_HD: { keywords: ["KIT DIESEL", "ENGINE HD", "MOTOR DIESEL"], prefix: "EK5" },
  KIT_LD: { keywords: ["KIT GASOLINE", "ENGINE LD", "MOTOR GASOLINA"], prefix: "EK3" }
};

// ============================
// CLASIFICACIÓN DE DUTY
// ============================
const HD_MANUFACTURERS = [
  "CATERPILLAR", "KOMATSU", "CUMMINS", "VOLVO", "MACK", "JOHN DEERE", "DETROIT DIESEL",
  "PERKINS", "CASE", "NEW HOLLAND", "SCANIA", "MERCEDES TRUCK", "KENWORTH", "PETERBILT",
  "FREIGHTLINER", "INTERNATIONAL", "MTU", "PACCAR", "HINO", "IVECO"
];

const LD_MANUFACTURERS = [
  "TOYOTA", "FORD", "MAZDA", "LEXUS", "NISSAN", "HONDA", "KIA", "HYUNDAI",
  "BMW", "MERCEDES BENZ", "VOLKSWAGEN", "AUDI", "CHEVROLET", "SUBARU",
  "DODGE", "RAM", "FIAT", "GMC", "ACURA", "INFINITI"
];

// ============================
// DETECCIÓN DE FAMILY
// ============================
function detectFamily(query) {
  const q = query.toUpperCase();
  for (const [family, rule] of Object.entries(FAMILY_RULES)) {
    if (rule.keywords.some(k => q.includes(k))) {
      return { family, prefix: rule.prefix };
    }
  }
  return { family: "UNKNOWN", prefix: "EXX" };
}

// ============================
// CLASIFICACIÓN HD / LD
// ============================
function detectDuty(query) {
  const q = query.toUpperCase();
  if (HD_MANUFACTURERS.some(m => q.includes(m)) || q.includes("DIESEL")) {
    return "HD";
  }
  if (LD_MANUFACTURERS.some(m => q.includes(m)) || q.includes("GASOLINA") || q.includes("GASOLINE")) {
    return "LD";
  }
  return "UNKNOWN";
}

// ============================
// GENERACIÓN DE SKU
// ============================
function generateSku(prefix, query, duty, oemOrCrossRef) {
  const numMatch = query.match(/\d{3,6}$/);
  const lastDigits = numMatch ? numMatch[0].slice(-4) : "0000";
  const dutySuffix = duty === "HD" ? lastDigits : lastDigits;
  return `${prefix}${dutySuffix}`;
}

// ============================
// DETECCIÓN PRINCIPAL
// ============================
async function detectFilter(query) {
  try {
    console.log(`🚀 DetectFilter iniciado para: ${query}`);

    const { family, prefix } = detectFamily(query);
    const duty = detectDuty(query);

    let homologatedSku = "GENERIC";
    let finalSku = `${prefix}0000`;

    // Determinar si Donaldson o Fram lo fabrican
    if (duty === "HD" && family !== "UNKNOWN") {
      homologatedSku = "DONALDSON";
    } else if (duty === "LD" && family !== "UNKNOWN") {
      homologatedSku = "FRAM";
    }

    // Generar SKU final
    finalSku = generateSku(prefix, query, duty, homologatedSku);

    // Crear descripción estándar
    const description = `Filter element for ${family.toLowerCase()} system in ${duty === "HD" ? "heavy-duty" : "light-duty"} applications.`;

    // Devuelve objeto completo para escritura en Sheet
    return {
      status: "OK",
      query_norm: query,
      family,
      duty,
      source: homologatedSku,
      homologated_sku: homologatedSku,
      final_sku: finalSku,
      filter_type: family,
      media_type: "SYNTHETIC",
      subtype: "",
      engine_applications: duty === "HD" ? "Diesel Engines" : "Gasoline Engines",
      equipment_applications: duty === "HD" ? "Heavy Equipment" : "Automotive",
      height_mm: "",
      outer_diameter_mm: "",
      thread_size: "",
      gasket_od_mm: "",
      gasket_id_mm: "",
      bypass_valve_psi: "",
      micron_rating: family === "OIL" ? "25" : "",
      iso_main_efficiency_percent: "",
      iso_test_method: "",
      beta_200: "",
      hydrostatic_burst_psi: "",
      dirt_capacity_grams: "",
      rated_flow_cfm: "",
      rated_flow_gpm: "",
      panel_width_mm: "",
      panel_depth_mm: "",
      manufacturing_standards: "ISO/TS 16949",
      certification_standards: "ISO 9001:2015",
      operating_pressure_min_psi: "",
      operating_pressure_max_psi: "",
      operating_temperature_min_c: "",
      operating_temperature_max_c: "",
      fluid_compatibility: "",
      disposal_method: "Recycle",
      weight_grams: "",
      category: "FILTER",
      name: finalSku,
      description
    };
  } catch (error) {
    console.error('❌ Error en detectFilter:', error.message);
    return {
      status: "ERROR",
      query_norm: query,
      error: error.message
    };
  }
}

module.exports = { detectFilter, setSheetsInstance };
