// detectionService.js — ELIMFILTERS SKU v3.0
// ==========================================
let sheetsInstance = null;
const NUMERIC_FALLBACK = "0001";

// =======================
// CONFIGURACIÓN INICIAL
// =======================
function setSheetsInstance(instance) {
  sheetsInstance = instance;
  console.log("✅ Google Sheets instance configurada correctamente");
}

// =======================
// PREFIJOS POR FAMILY / DUTY
// =======================
const PREFIX_RULES = {
  HD: {
    AIR: "EA1",
    FUEL: "EF9",
    OIL: "EL8",
    HYDRAULIC: "EH6",
    COOLANT: "EW7",
    CABIN: "EC1",
    "FUEL SEPARATOR": "ES9",
    "AIR DRYER": "ED4",
    CARCAZA: "EA2",
    TURBINE: "ET9",
    KITS: "EK5",
  },
  LD: {
    AIR: "EA1",
    FUEL: "EF9",
    OIL: "EL8",
    CABIN: "EC1",
    KITS: "EK3",
  },
};

// =======================
// DETECCIÓN DE FAMILY
// =======================
function detectFamily(context) {
  const text = (context || "").toUpperCase();
  const map = {
    AIR: ["AIR", "AIRE", "RADIAL", "AXIAL", "RS", "PRIMARY"],
    FUEL: ["FUEL", "COMBUSTIBLE", "FF", "FS", "DIESEL"],
    OIL: ["OIL", "ACEITE", "LF", "PH", "LUBRICANT"],
    HYDRAULIC: ["HYDRAULIC", "HIDRAULICO", "HF", "HH"],
    COOLANT: ["COOLANT", "REFRIGERANTE", "WF", "WATER"],
    CABIN: ["CABIN", "CABINA", "CF", "HVAC", "AC"],
    "FUEL SEPARATOR": ["SEPARATOR", "SEPARADOR", "COALESCER", "MODULE"],
    "AIR DRYER": ["DRYER", "SECADOR", "DESHUMIDIFICADOR"],
    CARCAZA: ["HOUSING", "BASE", "HEAD"],
    TURBINE: ["TURBINE", "TURBO", "PREFILTER", "PRE-FILTER"],
    KITS: ["KIT", "REPLACEMENT", "SET"],
  };

  let bestMatch = "UNKNOWN";
  let maxHits = 0;
  for (const [family, words] of Object.entries(map)) {
    const hits = words.filter((w) => text.includes(w)).length;
    if (hits > maxHits) {
      maxHits = hits;
      bestMatch = family;
    }
  }
  return bestMatch;
}

// =======================
// DETECCIÓN DE DUTY
// =======================
function detectDuty(context) {
  const text = (context || "").toUpperCase();

  const HD_MANUFACTURERS = [
    "CATERPILLAR", "CAT", "KOMATSU", "MACK", "VOLVO", "CUMMINS",
    "DETROIT", "JOHN DEERE", "CASE", "PACCAR", "FREIGHTLINER",
    "INTERNATIONAL", "SCANIA", "DONALDSON", "ISUZU", "MAN", "DAF",
    "NEW HOLLAND", "IVECO"
  ];

  const LD_MANUFACTURERS = [
    "TOYOTA", "FORD", "HONDA", "NISSAN", "HYUNDAI", "KIA",
    "CHEVROLET", "MAZDA", "BMW", "LEXUS", "MERCEDES BENZ",
    "SUBARU", "MITSUBISHI", "VOLKSWAGEN", "AUDI", "JEEP",
    "DODGE", "RAM", "GMC", "FRAM"
  ];

  let hd = HD_MANUFACTURERS.some((m) => text.includes(m));
  let ld = LD_MANUFACTURERS.some((m) => text.includes(m));

  if (hd && !ld) return "HD";
  if (ld && !hd) return "LD";
  if (text.includes("DIESEL")) return "HD";
  if (text.includes("GASOLINE")) return "LD";
  return "UNKNOWN";
}

// =======================
// EXTRACCIÓN DE 4 DÍGITOS
// =======================
function extractLast4Digits(value) {
  if (!value) return NUMERIC_FALLBACK;
  const digits = value.match(/\d+/g);
  if (!digits) return NUMERIC_FALLBACK;
  const all = digits.join("");
  const last4 = all.slice(-4);
  return last4.padStart(4, "0");
}

// =======================
// GENERACIÓN DE SKU FINAL
// =======================
async function detectFilter(query) {
  try {
    if (!sheetsInstance) throw new Error("Sheets no inicializado");
    const q = query.trim().toUpperCase();

    console.log(`🔍 Buscando ${q} en Google Sheets...`);
    const result = await sheetsInstance.searchInMaster(q);

    let family = "UNKNOWN";
    let duty = "UNKNOWN";
    let base = q;
    let oemCodes = "";
    let crossRefs = "";

    if (result.found) {
      const data = result.data;
      family = data.family || detectFamily(data.description);
      duty =
        data.duty ||
        detectDuty(
          (data.oem_codes || "") + " " + (data.cross_reference || "")
        );
      oemCodes = data.oem_codes || "";
      crossRefs = data.cross_reference || "";
    } else {
      family = detectFamily(q);
      duty = detectDuty(q);
    }

    if (duty === "UNKNOWN") duty = "HD";
    const prefixSet = PREFIX_RULES[duty] || PREFIX_RULES.HD;
    const prefix = prefixSet[family] || "EA1";

    // Determinar fuente según Duty
    let source = duty === "HD" ? "Donaldson" : "Fram";
    let sourceCode = duty === "HD" ? crossRefs : oemCodes;

    const last4 = extractLast4Digits(sourceCode || q);
    const finalSku = `${prefix}${last4}`.replace(/\D+$/, "");

    return {
      status: "OK",
      query: q,
      family,
      duty,
      source,
      homologated_sku: finalSku,
    };
  } catch (error) {
    console.error("❌ Error detectando filtro:", error);
    return { status: "ERROR", message: error.message };
  }
}

// =======================
module.exports = {
  detectFilter,
  setSheetsInstance,
};
