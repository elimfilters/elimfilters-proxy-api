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
const MASTER_RANGE = "MASTER!A:AZ";
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
      
      // 3. Buscar en source_code
      if (r.source_code && r.source_code.toUpperCase() === codeUpper) {
        console.log(`✅ Encontrado en campo source_code`);
        return true;
      }
      
      // 4. Buscar en query_norm
      if (r.query_norm && r.query_norm.toUpperCase() === codeUpper) {
        console.log(`✅ Encontrado en campo query_norm`);
        return true;
      }
      
      // 5. Buscar en cross_reference (array separado por comas)
      if (r.cross_reference) {
        const crossRefs = r.cross_reference.split(',').map(s => s.trim().toUpperCase());
        if (crossRefs.includes(codeUpper)) {
          console.log(`✅ Encontrado en cross_reference`);
          return true;
        }
      }
      
      // 6. Buscar en oem_codes (array separado por comas)
      if (r.oem_codes) {
        const oemCodes = r.oem_codes.split(',').map(s => s.trim().toUpperCase());
        if (oemCodes.includes(codeUpper)) {
          console.log(`✅ Encontrado en oem_codes`);
          return true;
        }
      }
      
      return false;
    });
    
    if (found) {
      console.log(`✅ [Sheets] Código encontrado - SKU: ${found.sku}`);
      return found;
    }
    
    console.log(`⚠️ [Sheets] Código no encontrado`);
    return null;
    
  } catch (err) {
    console.error('❌ Error en findExactCode:', err.message);
    return null;
  }
}

// ============================================================================
// GUARDAR NUEVO FILTRO (DATOS VERIFICADOS DE WEB)
// ============================================================================
async function saveNewFilter(filterData) {
  console.log(`💾 [Sheets] Guardando nuevo filtro: ${filterData.sku}`);
  
  try {
    // Preparar fila para Google Sheets
    const row = [
      filterData.sku || '',
      filterData.filter_type || '',
      filterData.duty || '',
      filterData.oem_code || '',
      filterData.source_code || '',
      filterData.query_norm || '',
      filterData.source || '',
      Array.isArray(filterData.cross_reference) ? filterData.cross_reference.join(', ') : '',
      Array.isArray(filterData.oem_codes) ? filterData.oem_codes.join(', ') : '',
      Array.isArray(filterData.engine_applications) ? filterData.engine_applications.join(', ') : '',
      Array.isArray(filterData.equipment_applications) ? filterData.equipment_applications.join(', ') : '',
      typeof filterData.specs === 'object' ? JSON.stringify(filterData.specs) : '',
      filterData.description || '',
      filterData.created_at || new Date().toISOString()
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
