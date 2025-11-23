// ============================================================================
// GOOGLE SHEETS CONNECTOR v2.2 — BÚSQUEDA RÁPIDA Y EFICIENTE
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
// BÚSQUEDA RÁPIDA (NUEVA FUNCIÓN EFICIENTE)
// ============================================================================
async function findExactCode(code) {
  if (!auth || !sheetsClient) {
    console.error('❌ [Sheets] Autenticación no inicializada.');
    return null;
  }

  const codeUpper = code.toUpperCase().trim();
  console.log(`🔍 [Sheets] Buscando código (búsqueda rápida): ${codeUpper}`);

  try {
    // Usar el filtro de la API de Google Sheets para una búsqueda ultra rápida
    // Busca en las columnas 'sku', 'oem_code' y 'query_norm'
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${MASTER_RANGE}?filter=(sku='${codeUpper}' or oem_code='${codeUpper}' or query_norm='${codeUpper}')`,
    });

    const rows = response.data.values;
    if (rows && rows.length > 0) {
      console.log(`✅ [Sheets] Encontrado ${rows.length} coincidencias rápidas.`);
      
      // Tomar la primera coincidencia
      const headerRow = rows[0];
      const firstMatch = rows[0];
      
      const rowObject = {};
      headerRow.forEach((header, index) => {
        rowObject[header] = firstMatch[index] || "";
      });
      
      // Mapear al formato estándar
      return mapSheetToStandard(rowObject);
    }

    console.log(`⚠️ [Sheets] Código no encontrado con búsqueda rápida.`);
    return null;

  } catch (err) {
    console.error(`❌ [Sheets] Error en findExactCode (búsqueda rápida):`, err.message);
    return null;
  }
}

// ============================================================================
// MAPEAR DATOS DEL SHEET AL FORMATO ESTÁNDAR
// ============================================================================
function mapSheetToStandard(sheetRow) {
  const specs = {};
  // (Puedes mantener toda la lógica de mapeo que ya tenías)
  if (sheetRow.height_mm) specs.height_mm = sheetRow.height_mm;
  // ... añadir todas las demás especificaciones aquí
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

console.log('✅ Google Sheets Connector v2.2 (Búsqueda Rápida) cargado');
