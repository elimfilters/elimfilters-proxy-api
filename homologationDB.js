// ============================================================================
// HOMOLOGATION DB SERVICE — ELIMFILTERS API
// Guarda códigos desconocidos (OEM / CROSS) para revisión y creación futura.
// ============================================================================

const sheets = require("./dataAccess");

// Nombre del sheet donde guardamos códigos desconocidos
const UNKNOWN_SHEET = "UnknownCodes";

// ============================================================================
// NORMALIZADOR
// ============================================================================
function normalize(code) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

// ============================================================================
// Registrar un código desconocido (NO duplicarlo)
// ============================================================================
async function saveUnknownCode(codeRaw) {
  const code = normalize(codeRaw);

  console.log(`[HOMOLOGATION] Registrando código desconocido → ${code}`);

  try {
    // Verificar si ya existe en la lista de unknown
    const exists = await sheets.queryByOEMorCross(code);

    if (exists) {
      console.log(`[HOMOLOGATION] Ya estaba registrado → SKU ${exists.sku || "N/A"}`);
      return { ok: true, alreadyExists: true };
    }

    // Insertar registro mínimo
    const row = {
      query_norm: code,
      sku: "",
      description: "",
      family: "",
      duty: "",
      oem_codes: code,
      cross_reference: "",
      media_type: "",
      filter_type: "",
      subtype: "",
      engine_applications: "",
      equipment_applications: "",
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
      oem_number: code,
      cross_brand: "",
      cross_part_number: "",
      manufactured_by: "",
      last4_source: "",
      last4_digits: "",
      source: "UNKNOWN",
      homologated_sku: "",
      review: "PENDING",
      specs: "{}",
      priority_reference: code,
      priority_brand_reference: "",
      ok: false
    };

    await sheets.saveUnknownCode(row);

    console.log(`[HOMOLOGATION] Código guardado correctamente.`);
    return { ok: true, saved: true };

  } catch (err) {
    console.error("[HOMOLOGATION] ERROR guardando código:", err);
    return { ok: false, error: err.message || "Error desconocido" };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  saveUnknownCode
};
