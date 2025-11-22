// ============================================================================
// GOOGLE SHEETS CONNECTOR v2.0 — MEJORADO
// - NUEVO: findExactCode() - Búsqueda exacta prioritaria
// - NUEVO: saveNewFilter() - Guardar datos verificados
// - NUEVO: saveUnknown() - Guardar códigos no encontrados
// - MEJORADO: Búsqueda optimizada
// ============================================================================

const { google } = require("googleapis");

// ============================================================================
// CONFIG
// ============================================================================
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "1ZYI5c0enkuvWAveu8HMaCUk1cek_VDrX8GtgKW7VP6U";

// Rangos de sheets
const MASTER_RANGE = "Master!A:AZ";
const UNKNOWN_RANGE = "UNKNOWN!A:C";

// ============================================================================
// AUTENTICACIÓN
// ============================================================================
function getAuth() {
  // Intenta usar GOOGLE_SHEETS_CREDENTIALS_JSON primero
  const credsJson = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
  
  if (credsJson) {
    try {
      const credentials = JSON.parse(credsJson);
      return new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
      });
    } catch (err) {
      console.error('❌ Error parseando GOOGLE_SHEETS_CREDENTIALS_JSON:', err.message);
    }
  }
  
  // Fallback a credenciales individuales
  return new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID || "gen-lang-client-0000922456",
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "elimfilters-railway@gen-lang-client-0000922456.iam.gserviceaccount.com",
      private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, '\n')
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

const auth = getAuth();
const sheetsClient = google.sheets({ version: "v4", auth });

// ============================================================================
// LEER TODAS LAS FILAS DEL MASTER
// ============================================================================
async function readAllRows() {
  try {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: MASTER_RANGE
    });

    const [header, ...rows] = res.data.values || [];
    if (!header) return [];

    return rows.map((r, idx) => {
      const obj = {};
      header.forEach((h, i) => {
        obj[h] = r[i] || "";
      });
      obj._rowIndex = idx + 2; // +2 porque header es fila 1, datos empiezan en 2
      return obj;
    });
  } catch (err) {
    console.error('❌ Error leyendo Google Sheets:', err.message);
    return [];
  }
}

// ============================================================================
// BUSCAR CÓDIGO EXACTO (NUEVA FUNCIÓN PRIORITARIA)
// ============================================================================
async function findExactCode(code) {
  console.log(`🔍 [Sheets] Buscando código exacto: ${code}`);
  
  try {
    const rows = await readAllRows();
    const codeUpper = code.toUpperCase().trim();
    
    // Buscar en múltiples campos
    const found = rows.find(r => {
      // 1. Buscar en SKU
      if (r.sku && r.sku.toUpperCase() === codeUpper) {
        console.log(`✅ Encontrado en campo SKU`);
        return true;
      }
      
      // 2. Buscar en oem_code
      if (r.oem_code && r.oem_code.toUpperCase() === codeUpper) {
        console.log(`✅ Encontrado en campo oem_code`);
        return true;
      }
      
      // 3. Buscar en query_norm
      if (r.query_norm && r.query_norm.toUpperCase() === codeUpper) {
        console.log(`✅ Encontrado en campo query_norm`);
        return true;
      }
      
      // 4. Buscar en cross_reference (array separado por comas)
      if (r.cross_reference) {
        const crossRefs = r.cross_reference.split(',').map(s => s.trim().toUpperCase());
        if (crossRefs.includes(codeUpper)) {
          console.log(`✅ Encontrado en cross_reference`);
          return true;
        }
      }
      
      return false;
    });
    
    if (found) {
      console.log(`✅ [Sheets] Código encontrado - SKU: ${found.sku}`);
      
      // Mapear datos del Sheet al formato esperado por detectionService
      const mappedData = mapSheetToStandard(found);
      return mappedData;
    }
    
    console.log(`⚠️ [Sheets] Código no encontrado`);
    return null;
    
  } catch (err) {
    console.error('❌ Error en findExactCode:', err.message);
    return null;
  }
}

// ============================================================================
// MAPEAR DATOS DEL SHEET AL FORMATO ESTÁNDAR
// ============================================================================
function mapSheetToStandard(sheetRow) {
  // Construir objeto specs desde columnas individuales
  const specs = {};
  
  if (sheetRow.height_mm) specs.height_mm = sheetRow.height_mm;
  if (sheetRow.outer_diameter_mm) specs.outer_diameter_mm = sheetRow.outer_diameter_mm;
  if (sheetRow.thread_size) specs.thread_size = sheetRow.thread_size;
  if (sheetRow.gasket_od_mm) specs.gasket_od_mm = sheetRow.gasket_od_mm;
  if (sheetRow.gasket_id_mm) specs.gasket_id_mm = sheetRow.gasket_id_mm;
  if (sheetRow.bypass_valve_psi) specs.bypass_valve_psi = sheetRow.bypass_valve_psi;
  if (sheetRow.micron_rating) specs.micron_rating = sheetRow.micron_rating;
  if (sheetRow.iso_main_efficiency_percent) specs.iso_main_efficiency_percent = sheetRow.iso_main_efficiency_percent;
  if (sheetRow.iso_test_method) specs.iso_test_method = sheetRow.iso_test_method;
  if (sheetRow.beta_200) specs.beta_200 = sheetRow.beta_200;
  if (sheetRow.hydrostatic_burst_psi) specs.hydrostatic_burst_psi = sheetRow.hydrostatic_burst_psi;
  if (sheetRow.dirt_capacity_grams) specs.dirt_capacity_grams = sheetRow.dirt_capacity_grams;
  if (sheetRow.rated_flow_cfm) specs.rated_flow_cfm = sheetRow.rated_flow_cfm;
  if (sheetRow.rated_flow_gpm) specs.rated_flow_gpm = sheetRow.rated_flow_gpm;
  if (sheetRow.panel_width_mm) specs.panel_width_mm = sheetRow.panel_width_mm;
  if (sheetRow.panel_depth_mm) specs.panel_depth_mm = sheetRow.panel_depth_mm;
  if (sheetRow.manufacturing_standards) specs.manufacturing_standards = sheetRow.manufacturing_standards;
  if (sheetRow.certification_standards) specs.certification_standards = sheetRow.certification_standards;
  if (sheetRow.operating_pressure_min_psi) specs.operating_pressure_min_psi = sheetRow.operating_pressure_min_psi;
  if (sheetRow.operating_pressure_max_psi) specs.operating_pressure_max_psi = sheetRow.operating_pressure_max_psi;
  if (sheetRow.operating_temperature_min_c) specs.operating_temperature_min_c = sheetRow.operating_temperature_min_c;
  if (sheetRow.operating_temperature_max_c) specs.operating_temperature_max_c = sheetRow.operating_temperature_max_c;
  if (sheetRow.fluid_compatibility) specs.fluid_compatibility = sheetRow.fluid_compatibility;
  if (sheetRow.disposal_method) specs.disposal_method = sheetRow.disposal_method;
  if (sheetRow.weight_grams) specs.weight_grams = sheetRow.weight_grams;
  if (sheetRow.service_life_hours) specs.service_life_hours = sheetRow.service_life_hours;
  if (sheetRow.change_interval_km) specs.change_interval_km = sheetRow.change_interval_km;
  if (sheetRow.water_separation_efficiency_percent) specs.water_separation_efficiency_percent = sheetRow.water_separation_efficiency_percent;
  if (sheetRow.drain_type) specs.drain_type = sheetRow.drain_type;
  if (sheetRow.media_type) specs.media_type = sheetRow.media_type;
  
  return {
    sku: sheetRow.sku || '',
    filter_type: sheetRow.family || sheetRow.filter_type || '',
    duty: sheetRow.duty || '',
    oem_code: sheetRow.oem_code || '',
    source_code: sheetRow.oem_code || sheetRow.query_norm || '',
    query_norm: sheetRow.query_norm || '',
    source: 'google_sheets',
    cross_reference: sheetRow.cross_reference || '',
    oem_codes: sheetRow.oem_code || '',
    engine_applications: sheetRow.engine_applications || '',
    equipment_applications: sheetRow.equipment_applications || '',
    specs: specs,
    description: sheetRow.description || '',
    created_at: sheetRow.created_at || new Date().toISOString(),
    subtype: sheetRow.subtype || ''
  };
}

// ============================================================================
// GUARDAR NUEVO FILTRO (DATOS VERIFICADOS DE WEB)
// ============================================================================
async function saveNewFilter(filterData) {
  console.log(`💾 [Sheets] Guardando nuevo filtro: ${filterData.sku}`);
  
  try {
    // Extraer specs individuales del objeto specs
    const specs = filterData.specs || {};
    
    // Preparar fila para Google Sheets (orden según tus columnas)
    const row = [
      filterData.query_norm || filterData.oem_code || '',
      filterData.sku || '',
      filterData.description || '',
      filterData.filter_type || '',  // family
      filterData.duty || '',
      filterData.oem_code || '',
      Array.isArray(filterData.cross_reference) ? filterData.cross_reference.join(', ') : filterData.cross_reference || '',
      specs.media_type || '',
      filterData.filter_type || '',
      filterData.subtype || '',
      Array.isArray(filterData.engine_applications) ? filterData.engine_applications.join(', ') : filterData.engine_applications || '',
      Array.isArray(filterData.equipment_applications) ? filterData.equipment_applications.join(', ') : filterData.equipment_applications || '',
      specs.height_mm || '',
      specs.outer_diameter_mm || '',
      specs.thread_size || '',
      specs.gasket_od_mm || '',
      specs.gasket_id_mm || '',
      specs.bypass_valve_psi || '',
      specs.micron_rating || '',
      specs.iso_main_efficiency_percent || '',
      specs.iso_test_method || '',
      specs.beta_200 || '',
      specs.hydrostatic_burst_psi || '',
      specs.dirt_capacity_grams || '',
      specs.rated_flow_cfm || '',
      specs.rated_flow_gpm || '',
      specs.panel_width_mm || '',
      specs.panel_depth_mm || '',
      specs.manufacturing_standards || '',
      specs.certification_standards || '',
      specs.operating_pressure_min_psi || '',
      specs.operating_pressure_max_psi || '',
      specs.operating_temperature_min_c || '',
      specs.operating_temperature_max_c || '',
      specs.fluid_compatibility || '',
      specs.disposal_method || '',
      specs.weight_grams || '',
      specs.service_life_hours || '',
      specs.change_interval_km || '',
      specs.water_separation_efficiency_percent || '',
      specs.drain_type || ''
    ];
    
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: MASTER_RANGE,
      valueInputOption: 'RAW',
      resource: {
        values: [row]
      }
    });
    
    console.log(`✅ [Sheets] Filtro guardado exitosamente`);
    return true;
    
  } catch (err) {
    console.error('❌ Error guardando en Sheets:', err.message);
    return false;
  }
}

// ============================================================================
// GUARDAR CÓDIGO DESCONOCIDO
// ============================================================================
async function saveUnknown(code) {
  console.log(`📝 [Sheets] Guardando código desconocido: ${code}`);
  
  try {
    const row = [
      code,
      new Date().toISOString(),
      'Pendiente de investigación'
    ];
    
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: UNKNOWN_RANGE,
      valueInputOption: 'RAW',
      resource: {
        values: [row]
      }
    });
    
    console.log(`✅ [Sheets] Código desconocido guardado`);
    return true;
    
  } catch (err) {
    console.error('❌ Error guardando en UNKNOWN:', err.message);
    return false;
  }
}

// ============================================================================
// BUSCAR POR SKU (LEGACY)
// ============================================================================
async function findRowBySKU(sku) {
  const rows = await readAllRows();
  return rows.find(r => r.sku === sku) || null;
}

// ============================================================================
// BUSCAR POR OEM / CROSS (LEGACY)
// ============================================================================
async function findRowByOEM(code) {
  // Usar nueva función findExactCode que es más precisa
  return await findExactCode(code);
}

// ============================================================================
// FIND CROSS REFERENCE (LEGACY - mantener para compatibilidad)
// ============================================================================
async function findCrossReference(partNumber) {
  const found = await findExactCode(partNumber);
  if (!found) return null;
  
  return {
    donaldson: found.source_code || '',
    fram: found.cross_reference || '',
    sku: found.sku || ''
  };
}

// ============================================================================
// REPLACE OR INSERT ROW (LEGACY - mantener para compatibilidad)
// ============================================================================
async function replaceOrInsertRow(data) {
  // Por ahora, siempre insertar nuevo
  // TODO: Implementar lógica de reemplazo si existe
  return await saveNewFilter(data);
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  // Nuevas funciones prioritarias
  findExactCode,
  saveNewFilter,
  saveUnknown,
  
  // Funciones legacy (compatibilidad)
  readAllRows,
  findRowBySKU,
  findRowByOEM,
  findCrossReference,
  replaceOrInsertRow
};

console.log('✅ Google Sheets Connector v2.0 cargado');
