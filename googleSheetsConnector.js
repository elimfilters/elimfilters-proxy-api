// ============================================================================
// GOOGLE SHEETS CONNECTOR v2.3 — MÉTODO SEGURO Y ROBUSTO
// ============================================================================
const { google } = require("googleapis");

// ============================================================================
// CONFIGURACIÓN
// ============================================================================
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const MASTER_RANGE = "Master!A:AZ"; // Nombre de la hoja confirmado: "Master"

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
// BÚSQUEDA SEGUURA (Descargar y buscar en memoria)
// ============================================================================
async function findExactCode(code) {
  if (!auth || !sheetsClient) {
    console.error('❌ [Sheets] Autenticación no inicializada.');
    return null;
  }

  const codeUpper = code.toUpperCase().trim();
  console.log(`🔍 [Sheets] Buscando código (método seguro): ${codeUpper}`);

  try {
    // 1. Descargar toda la hoja (más lento pero 100% seguro)
    console.log('📥 [Sheets] Descargando hoja "Master"...');
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: MASTER_RANGE
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('⚠️ [Sheets] La hoja "Master" está vacía o no tiene datos.');
      return null;
    }

    // 2. Buscar en los datos descargados
    console.log(`🔍 [Sheets] Buscando en ${rows.length} filas descargadas...`);
    const headerRow = rows[0];
    
    // Buscar en múltiples campos como antes
    const found = rows.find((row, index) => {
      if (index === 0) return false; // Ignorar la fila de encabezados
      
      const sku = (row[headerRow.indexOf('sku')] || '').toUpperCase();
      const oem = (row[headerRow.indexOf('oem_code')] || '').toUpperCase();
      const query = (row[headerRow.indexOf('query_norm')] || '').toUpperCase();
      const crossRefs = (row[headerRow.indexOf('cross_reference')] || '').split(',').map(s => s.trim().toUpperCase());

      if (sku === codeUpper || oem === codeUpper || query === codeUpper || crossRefs.includes(codeUpper)) {
        console.log(`✅ [Sheets] Fila encontrada en el índice ${index}!`);
        return true;
      }
      return false;
    });

    if (found) {
      console.log(`✅ [Sheets] Código ${codeUpper} encontrado exitosamente.`);
      return mapSheetToStandard(found, headerRow);
    }

    console.log(`⚠️ [Sheets] Código ${codeUpper} no encontrado.`);
    return null;

  } catch (err) {
    console.error(`❌ [Sheets] Error en findExactCode (método seguro):`, err.message);
    return null;
  }
}

// ============================================================================
// MAPEAR DATOS DEL SHEET AL FORMATO ESTÁNDAR
// ============================================================================
function mapSheetToStandard(sheetRow, headerRow) {
  const specs = {};
  // Mapear specs desde columnas individuales (puedes añadir más si es necesario)
  if (sheetRow[headerRow.indexOf('height_mm')]) specs.height_mm = sheetRow[headerRow.indexOf('height_mm')];
  if (sheetRow[headerRow.indexOf('filter_type')]) specs.filter_type = sheetRow[headerRow.indexOf('filter_type')];
  if (sheetRow[headerRow.indexOf('duty')]) specs.duty = sheetRow[headerRow.indexOf('duty')];
  // ... (añadir más mapeos de specs aquí si es necesario)

  return {
    sku: sheetRow[headerRow.indexOf('sku')] || '',
    filter_type: sheetRow[headerRow.indexOf('filter_type')] || sheetRow[headerRow.indexOf('family')] || '',
    duty: sheetRow[headerRow.indexOf('duty')] || '',
    oem_code: sheetRow[headerRow.indexOf('oem_code')] || '',
    source_code: sheetRow[headerRow.indexOf('oem_code')] || sheetRow[headerRow.indexOf('query_norm')] || '',
    query_norm: sheetRow[headerRow.indexOf('query_norm')] || '',
    source: 'google_sheets',
    cross_reference: sheetRow[headerRow.indexOf('cross_reference')] || '',
    equipment_applications: sheetRow[headerRow.indexOf('equipment_applications')] || '',
    specs: specs,
    description: sheetRow[headerRow.indexOf('description')] || '',
    created_at: sheetRow[headerRow.indexOf('created_at')] || new Date().toISOString(),
    subtype: sheetRow[headerRow.indexOf('subtype')] || ''
  };
}

// Placeholder functions para compatibilidad
async function saveNewFilter(filterData) { console.log('📝 [Sheets] saveNewFilter no implementado.'); }
async function saveUnknown(code) { console.log('📝 [Sheets] saveUnknown no implementado.'); }
async function findRowBySKU(sku) { console.log('📝 [Sheets] findRowBySKU no implementado.'); }
async function findRowByOEM(code) { console.log('📝 [Sheets] findRowByOEM no implementado.'); }

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  findExactCode,
  saveNewFilter,
  saveUnknown,
  findRowBySKU,
  findRowByOEM
};

console.log('✅ Google Sheets Connector v2.3 (Método Seguro) cargado');
