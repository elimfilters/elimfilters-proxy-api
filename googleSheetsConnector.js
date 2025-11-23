// ============================================================================
// GOOGLE SHEETS CONNECTOR v2.4 — MÉTODO SIMPLE Y ROBUSTO
// ============================================================================
const { google } = require("googleapis");

// ============================================================================
// CONFIGURACIÓN
// ============================================================================
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const MASTER_RANGE = "Master!A:AZ"; // Asegúrate que tu hoja se llama 'Master'

// ============================================================================
// AUTENTICACIÓN (SERVICE ACCOUNT)
// ============================================================================
function getAuth() {
  const credsJson = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
  if (credsJson) {
    try {
      const credentials = JSON.parse(credsJson);
      return new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
      });
    } catch (err) {
      console.error('❌ Error parseando GOOGLE_SHEETS_CREDENTIALS_JSON:', err.message);
    }
  }
  // Fallback a credenciales individuales si es necesario
  return new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID,
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, '\n')
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });
}

const auth = getAuth();
const sheetsClient = google.sheets({ version: "v4", auth });

// ============================================================================
// FUNCIÓN DE BÚSQUEDA (SIMPLE Y ROBUSTA)
// ============================================================================
async function findExactCode(code) {
  if (!auth || !sheetsClient) {
    console.error('❌ [Sheets] Autenticación no inicializada.');
    return null;
  }

  const codeUpper = code.toUpperCase().trim();
  console.log(`🔍 [Sheets] Buscando código (método simple): ${codeUpper}`);

  try {
    // 1. Pedir TODOS los datos de la hoja (más lento pero más seguro)
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: MASTER_RANGE
    });

    const [header, ...rows] = response.data.values || [];
    if (!header || rows.length === 0) {
      console.log('⚠️ [Sheets] Hoja vacía o sin encabezados.');
      return null;
    }

    // 2. Crear un objeto para cada fila para facilitar la búsqueda
    const dataObjects = rows.map(row => {
      const obj = {};
      header.forEach((h, i) => {
        obj[h] = row[i] || "";
      });
      return obj;
    });

    // 3. Buscar en los campos importantes
    const found = dataObjects.find(r => {
      if (r.sku && r.sku.toUpperCase() === codeUpper) return true;
      if (r.oem_code && r.oem_code.toUpperCase() === codeUpper) return true;
      if (r.query_norm && r.query_norm.toUpperCase() === codeUpper) return true;
      if (r.cross_reference) {
        const crossRefs = r.cross_reference.split(',').map(s => s.trim().toUpperCase());
        if (crossRefs.includes(codeUpper)) return true;
      }
      return false;
    });

    if (found) {
      console.log(`✅ [Sheets] Fila encontrada para ${codeUpper}.`);
      return mapSheetToStandard(found);
    }

    console.log(`⚠️ [Sheets] Código ${codeUpper} no encontrado.`);
    return null;

  } catch (err) {
    console.error(`❌ [Sheets] Error en findExactCode (método simple):`, err.message);
    return null;
  }
}

// ============================================================================
// MAPEAR DATOS DEL SHEET AL FORMATO ESTÁNDAR
// ============================================================================
function mapSheetToStandard(sheetRow) {
  const specs = {};
  if (sheetRow.height_mm) specs.height_mm = sheetRow.height_mm;
  // ... (copia toda la función mapSheetToStandard que ya tenías)
  if (sheetRow.filter_type) specs.filter_type = sheetRow.filter_type;
  if (sheetRow.duty) specs.duty = sheetRow.duty;
  
  return {
    sku: sheetRow.sku || '',
    filter_type: sheetRow.filter_type || sheetRow.family || '',
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

// Placeholder functions para compatibilidad
async function saveNewFilter(filterData) { console.log('📝 [Sheets] saveNewFilter no implementado.'); }
async function saveUnknown(code) { console.log('📝 [Sheets] saveUnknown no implementado.'); }
async function findRowBySKU(sku) { console.log('📝 [Sheets] findRowBySKU no implementado.'); }
async function findRowByOEM(code) { console.log('📝 [Sheets] findRowByOEM no implementado.'); }
async function readAllRows() { console.log('📝 [Sheets] readAllRows no implementado.'); }

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  findExactCode,
  saveNewFilter,
  saveUnknown,
  findRowBySKU,
  findRowByOEM,
  readAllRows
};

console.log('✅ Google Sheets Connector v2.4 (Método Simple) cargado');
