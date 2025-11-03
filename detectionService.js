// detectionService.js
const normalizeQuery = require('./utils/normalizeQuery');
let sheetsInstance = null;

/** Vincula la instancia de Google Sheets */
function setSheetsInstance(instance) {
  sheetsInstance = instance;
  console.log('✅ Google Sheets instance configurada en detectionService');
}

/** 
 * Detecta el filtro según la hoja o, si no existe, genera un registro nuevo
 */
async function detectFilter(query) {
  if (!sheetsInstance) throw new Error('Google Sheets no inicializado');

  const normalized = normalizeQuery(query);
  console.log(`🔍 Procesando consulta: ${normalized}`);

  try {
    // Buscar en hoja Master
    const row = await sheetsInstance.findRowByQuery(normalized);
    if (row) {
      console.log(`✅ Encontrado en hoja Master: ${normalized}`);
      return { status: 'OK', source: 'Master', data: row };
    }

    // Si no está, generar base técnica
    console.log('⚙️ No encontrado. Generando datos base...');
    const generated = {
      query_norm: normalized,
      sku: '',
      family: '',
      duty: '',
      oem_codes: '',
      cross_reference: '',
      filter_type: '',
      media_type: '',
      subtype: '',
      engine_applications: '',
      equipment_applications: '',
      height_mm: '',
      outer_diameter_mm: '',
      thread_size: '',
      gasket_od_mm: '',
      gasket_id_mm: '',
      bypass_valve_psi: '',
      micron_rating: '',
      iso_main_efficiency_percent: '',
      iso_test_method: '',
      beta_200: '',
      hydrostatic_burst_psi: '',
      dirt_capacity_grams: '',
      rated_flow_cfm: '',
      rated_flow_gpm: '',
      panel_width_mm: '',
      panel_depth_mm: '',
      manufacturing_standards: '',
      certification_standards: '',
      operating_pressure_min_psi: '',
      operating_pressure_max_psi: '',
      operating_temperature_min_c: '',
      operating_temperature_max_c: '',
      fluid_compatibility: '',
      disposal_method: '',
      weight_grams: '',
      category: '',
      name: normalized,
      description: 'Filtro técnico general. Datos pendientes de homologación.'
    };

    // Guardar nueva línea
    await sheetsInstance.appendRow(generated);
    console.log(`🆕 Agregado nuevo registro: ${normalized}`);

    return { status: 'OK', source: 'Generated', data: generated };
  } catch (err) {
    console.error('❌ Error en detectFilter:', err);
    return { status: 'ERROR', message: err.message };
  }
}

module.exports = { setSheetsInstance, detectFilter };
