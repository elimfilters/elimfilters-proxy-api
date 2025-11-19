// ============================================================================
// ELIMFILTERS — FILTER PROCESSOR v3.0
// Construye la fila completa con toda la metadata para Master Sheet
// ============================================================================

const detectionService = require("../services/detectionService");

// UTILIDAD: agrupar modelos repetidos
function groupApplications(list) {
  if (!Array.isArray(list) || list.length === 0) return "";

  const byBrand = {};

  list.forEach(entry => {
    const [brand, model] = entry.split(" ", 2);
    if (!byBrand[brand]) byBrand[brand] = [];
    byBrand[brand].push(model);
  });

  return Object.entries(byBrand)
    .map(([brand, models]) => `${brand} ${models.join(", ")}`)
    .join(" | ");
}

// UTILIDAD: sanitizar OEM y CROSS
function cleanList(raw) {
  if (!raw) return "";
  const arr = Array.isArray(raw) ? raw : String(raw).split(/[,;\n]+/);

  const clean = arr
    .map(v => String(v).trim().toUpperCase().replace(/[^A-Z0-9\-]/g, ""))
    .filter(Boolean);

  return clean.slice(0, 10).join(",");
}

// ============================================================================
// PROCESADOR PRINCIPAL
// ============================================================================
async function processFilterCode(code) {
  const base = await detectionService.analyzeCode(code);  
  const {
    sku,
    family,
    duty,
    media_type,
    filter_type,
    subtype,
    prefix,
    last4_digits
  } = base;

  // ------------------------------------------------------------
  // OEM LIST (simulada en esta etapa)
  // ------------------------------------------------------------
  const oemList = [
    `${code}`,
    `${code}-A`,
    `${code}-B`,
    `${code}-C`
  ];

  // ------------------------------------------------------------
  // CROSS LIST simulada (1 a 10)
  // ------------------------------------------------------------
  const crossList = [
    "P551807",
    "LF691A",
    "AF27891",
    "BF7587",
    "PH3950",
    "CA9898"
  ];

  // ------------------------------------------------------------
  // ENGINE APPLICATIONS agrupado
  // ------------------------------------------------------------
  const engineAppsRaw = [
    "CAT C7",
    "CAT C9",
    "CAT C13",
    "Komatsu SAA6D102E",
    "Komatsu SAA6D107E",
    "John Deere 6068",
    "John Deere 4045"
  ];

  const engine_applications = groupApplications(engineAppsRaw);

  // ------------------------------------------------------------
  // EQUIPMENT APPLICATIONS agrupado + años
  // ------------------------------------------------------------
  const equipRaw = [
    "CAT 320D (2006–2015)",
    "CAT 420F (2012–2018)",
    "CAT 950H (2007–2014)",
    "Komatsu PC200-8 (2008–2015)",
    "John Deere 544K (2010–2018)"
  ];

  const equipment_applications = groupApplications(equipRaw);

  // ------------------------------------------------------------
  // RESULTADO FINAL → FILA COMPLETA PARA MASTER SHEET
  // ------------------------------------------------------------
  const row = {
    query_norm: code.toUpperCase(),
    sku,
    description: `${family} filter — ${sku}`,
    family,
    duty,
    oem_codes: cleanList(oemList),
    cross_reference: cleanList(crossList),
    media_type,
    filter_type,
    subtype,
    engine_applications,
    equipment_applications,

    // Especificaciones genéricas (vacías)
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
    oem_number: "",
    cross_brand: "",
    cross_part_number: "",
    manufactured_by: "",
    last4_source: "OEM/CROSS",
    last4_digits,
    source: "ENGINE_V3",
    homologated_sku: sku,
    review: "",
    all_cross_references: cleanList([...oemList, ...crossList]),
    specs: "",
    priority_reference: oemList[0],
    priority_brand_reference: "OEM",

    ok: true
  };

  return { results: [row] };
}

module.exports = {
  processFilterCode
};
