// ============================================================================
// ELIMFILTERS – BUSINESS LOGIC ENGINE (FINAL VERSION)
// Generación de SKUs, multi-códigos, familia, duty, media y campos Master Sheet
// ============================================================================

const detectionService = require("../services/detectionService");
const jsonBuilder = require("../utils/jsonBuilder");

// Prefijos oficiales
const PREFIX = {
  AIR: "EA1",            // HD y LD
  OIL: "EL8",            // HD y LD
  FUEL: "EF9",           // HD y LD
  HYDRAULIC: "EH6",      // HD
  CABIN: "EC1",          // HD y LD
  CARCAZAS: "EA2",       // HD
  AIRDRYER: "ED4",       // HD
  COOLANT: "EW7",        // HD
  SEPARATOR: "ES9",      // HD
  KIT_HD: "EK5",         // HD
  KIT_LD: "EK6"          // LD
};

// Media oficial por familia
const MEDIA = {
  OIL: "ELIMTEK™",
  FUEL: "ELIMTEK™",
  HYDRAULIC: "ELIMTEK™",
  AIR: "MACROCORE™",
  CABIN: "MICROKAPPA™"
};

// ============================================================================
// Determinar familia por marca o patrón
// ============================================================================
function resolveFamily(code) {
  const fam = detectionService.detectFamily(code); // heurística base

  if (fam === "AIR") return "AIR";
  if (fam === "FUEL") return "FUEL";
  if (fam === "HYDRAULIC") return "HYDRAULIC";

  return "OIL"; // fallback
}

// ============================================================================
// Determinar DUTY final según fabricante
// ============================================================================
function resolveDuty(brand) {
  brand = (brand || "").toUpperCase();

  // OEM → si es maquinaria, automáticamente HD
  const HD_BRANDS = [
    "CATERPILLAR", "CAT", "KOMATSU", "JOHNDEERE", "DEERE",
    "VOLVO", "VOLVOCE", "HITACHI", "CASE", "NEWHOLLAND",
    "MACK", "MAN", "SCANIA", "RENAULTTRUCKS", "INTERNATIONAL",
    "NAVISTAR", "DOOSAN"
  ];

  const LD_BRANDS = [
    "TOYOTA", "NISSAN", "HYUNDAI",
    "HINO", "ISUZU", "YANMAR", "MITSUBISHIFUSO"
  ];

  if (HD_BRANDS.includes(brand)) return "HD";
  if (LD_BRANDS.includes(brand)) return "LD";

  // Si el brand es desconocido → Default HD
  return "HD";
}

// ============================================================================
// Construye un SKU a partir de prefijo + last4
// ============================================================================

function buildSKU(family, duty, last4) {
  family = family.toUpperCase();
  duty = duty.toUpperCase();

  if (!/^[0-9]{4}$/.test(last4)) last4 = "0000";

  let prefix = PREFIX[family];

  // FAMILY + duty combos especiales
  if (family === "HYDRAULIC") prefix = PREFIX.HYDRAULIC;
  if (family === "CABIN") prefix = PREFIX.CABIN;

  return prefix + last4;
}

// ============================================================================
// Procesamiento MULTI-CÓDIGOS
// ============================================================================

function generateMultiSKU({ originalOEM, brand, equivalents, family }) {
  const duty = resolveDuty(brand);

  const donaldsonList = equivalents.filter(e => e.brand === "DONALDSON");
  const framList = equivalents.filter(e => e.brand === "FRAM");
  const oemList = equivalents.filter(e => e.brand === "OEM");

  const results = [];

  equivalents.slice(0, 10).forEach((item, index) => {
    const baseLast4 = item.code.slice(-4);
    const sku = buildSKU(family, duty, baseLast4);

    const entry = {
      sku,
      homologated_sku: sku,
      priority_reference: index === 0 ? "PRIMARY" : "SECONDARY",
      priority_brand_reference: item.brand,
      source: "ENGINE_MULTI",
      last4_source: item.code,
      last4_digits: baseLast4,
      manufactured_by: item.brand,
      duty,
      family,
    };

    results.push(entry);
  });

  return results;
}

// ============================================================================
// Armar fila MASTER SHEET
// ============================================================================
function buildMasterRow({ query_norm, result, oem_codes, cross_codes, family, duty }) {
  const media = MEDIA[family] || "ELIMTEK™";

  const primary = result[0]; // PRIMARIO

  return {
    query_norm,
    sku: primary.sku,
    homologated_sku: primary.homologated_sku,
    family,
    duty,
    media_type: media,
    filter_type: family === "AIR" ? "Air Filter" :
                family === "CABIN" ? "Cabin Filter" :
                family === "FUEL" ? "Fuel Filter" :
                family === "HYDRAULIC" ? "Hydraulic Filter" :
                "Oil Filter",

    subtype: "SPIN-ON",

    oem_codes: oem_codes.slice(0, 10).join(","),
    cross_reference: cross_codes.slice(0, 10).join(","),

    // Campos técnicos (vacíos)
    height_mm: "",
    outer_diameter_mm: "",
    thread_size: "",
    gasket_od_mm: "",
    gasket_id_mm: "",
    bypass_valve_psi: "",
    micron_rating: "",
    iso_main_efficiency_percent: "",
    iso_test_method: "",
    beta_200: "",
    hydrostatic_burst_psi: "",
    dirt_capacity_grams: "",
    rated_flow_cfm: "",
    rated_flow_gpm: "",
    panel_width_mm: "",
    panel_depth_mm: "",
    manufacturing_standards: "",
    certification_standards: "",
    operating_pressure_min_psi: "",
    operating_pressure_max_psi: "",
    operating_temperature_min_c: "",
    operating_temperature_max_c: "",
    fluid_compatibility: "",
    disposal_method: "",
    weight_grams: "",
    service_life_hours: "",
    change_interval_km: "",
    water_separation_efficiency_percent: "",
    drain_type: "",

    all_cross_references: cross_codes.slice(0, 10).join(","),
    review: "AUTO",
    ok: true
  };
}

// ============================================================================
// FINAL: FUNCIÓN PRINCIPAL
// ============================================================================
async function processBusiness(code, equivalents) {
  const query_norm = detectionService.normalize(code);
  const brand = detectionService.detectBrand(code);
  const family = resolveFamily(code);
  const duty = resolveDuty(brand);

  const resultRows = generateMultiSKU({
    originalOEM: code,
    brand,
    equivalents,
    family
  });

  const oemList = equivalents.filter(e => e.brand === "OEM").map(e => e.code);
  const crossList = equivalents.filter(e => e.brand !== "OEM").map(e => e.code);

  const masterRow = buildMasterRow({
    query_norm,
    result: resultRows,
    oem_codes: oemList,
    cross_codes: crossList,
    family,
    duty
  });

  return {
    multi_results: resultRows,
    master_row: masterRow
  };
}

module.exports = {
  processBusiness
};
