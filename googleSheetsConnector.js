// ============================================================================
// GOOGLE SHEETS CONNECTOR v2.4 — VERSIÓN FINAL CORREGIDA
// ============================================================================
const { google } = require("googleapis");

// ============================================================================
// CONFIGURACIÓN
// ============================================================================
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const MASTER_RANGE = "Master!A:AZ";

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
// BÚSQUEDA FINAL CORREGIDA (Usa los nombres de columna REALES)
// ============================================================================
async function findExactCode(code) {
  if (!auth || !sheetsClient) {
    console.error('❌ [Sheets] Autenticación no inicializada.');
    return null;
  }

  const codeUpper = code.toUpperCase().trim();
  console.log(`🔍 [Sheets] Buscando código (versión final): ${codeUpper}`);

  try {
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

    const headerRow = rows[0]; // Guardamos los encabezados reales
    
    // Buscar en los campos CORRECTOS
    const found = rows.find((row, index) => {
      if (index === 0) return false; // Ignorar la fila de encabezados
      
      const sku = (row[headerRow.indexOf('sku')] || '').toUpperCase();
      const oem_codes = (row[headerRow.indexOf('oem_codes')] || '').split(',').map(s => s.trim().toUpperCase());
      const query_norm = (row[headerRow.indexOf('query_norm')] || '').toUpperCase();
      const cross_refs = (row[headerRow.indexOf('cross_reference')] || '').split(',').map(s => s.trim().toUpperCase());

      if (sku === codeUpper || oem_codes.includes(codeUpper) || query_norm === codeUpper || cross_refs.includes(codeUpper)) {
        console.log(`✅ [Sheets] Fila encontrada en el índice ${index}!`);
        return true;
      }
      return false;
    });

    if (found) {
      console.log(`✅ [Sheets] Código ${codeUpper} encontrado exitosamente.`);
      // Usamos los encabezados reales para mapear
      return mapSheetToStandard(found, headerRow);
    }

    console.log(`⚠️ [Sheets] Código ${codeUpper} no encontrado.`);
    return null;

  } catch (err) {
    console.error(`❌ [Sheets] Error en findExactCode (versión final):`, err.message);
    return null;
  }
}

// ============================================================================
// MAPEAR DATOS DEL SHEET AL FORMATO ESTÁNDAR (Usa nombres de columna REALES)
// ============================================================================
function mapSheetToStandard(sheetRow, headerRow) {
  const specs = {};
  // Usamos headerRow.indexOf para encontrar la columna correcta
  if (sheetRow[headerRow.indexOf('height_mm')]) specs.height_mm = sheetRow[headerRow.indexOf('height_mm')];
  if (sheetRow[headerRow.indexOf('outer_diameter_mm')]) specs.outer_diameter_mm = sheetRow[headerRow.indexOf('outer_diameter_mm')];
  if (sheetRow[headerRow.indexOf('thread_size')]) specs.thread_size = sheetRow[headerRow.indexOf('thread_size')];
  // ... puedes añadir el resto de las especificaciones aquí si es necesario

  return {
    sku: sheetRow[headerRow.indexOf('sku')] || '',
    // Usamos 'famiy' que es el nombre real en la hoja
    filter_type: sheetRow[headerRow.indexOf('famiy')] || sheetRow[headerRow.indexOf('filter_type')] || '',
    duty: sheetRow[headerRow.indexOf('duty')] || '',
    // Usamos 'oem_codes' que es el nombre real en la hoja
    oem_code: sheetRow[headerRow.indexOf('oem_codes')] || sheetRow[headerRow.indexOf('oem_number')] || '',
    source_code: sheetRow[headerRow.indexOf('oem_codes')] || sheetRow[headerRow.indexOf('query_norm')] || '',
    query_norm: sheetRow[headerRow.indexOf('query_norm')] || '',
    source: 'google_sheets',
    cross_reference: sheetRow[headerRow.indexOf('cross_reference')] || '',
    // Usamos 'engine_applications' que es el nombre real en la hoja
    equipment_applications: sheetRow[headerRow.indexOf('engine_applications')] || '',
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

console.log('✅ Google Sheets Connector v2.4 (Versión Final Corregida) cargado');
