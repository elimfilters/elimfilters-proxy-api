// ============================================================================
// ELIMFILTERS — DATA ACCESS v3.0
// Acceso unificado a datos locales + Master Sheet
// ============================================================================

const GoogleSheetsService = require("./googleSheetsConnector");
const sheets = new GoogleSheetsService();

// Inicializar Google Sheets al cargar módulo
(async () => {
  try {
    await sheets.initialize();
    console.log("📄 [DATA] Google Sheets conectado");
  } catch (err) {
    console.error("❌ [DATA] Error inicializando Sheets:", err.message);
  }
})();

// Normalización mínima
function normalize(code) {
  return String(code || "").trim().toUpperCase();
}

// ============================================================================
// BUSCAR POR SKU (columna 'sku')
// ============================================================================
async function queryBySKU(sku) {
  try {
    const norm = normalize(sku);
    const row = await sheets.findRowByQuery(norm);
    if (!row || !row.found) return null;
    return row;
  } catch (err) {
    console.error("❌ [DATA] Error buscando SKU:", err.message);
    return null;
  }
}

// ============================================================================
// BUSCAR POR OEM / CROSS (base externa futura)
// ============================================================================
async function queryOEM(code) {
  try {
    const norm = normalize(code);
    const row = await sheets.findRowByOEM(norm);
    return row;
  } catch (err) {
    return null;
  }
}

// ============================================================================
// GUARDAR / ACTUALIZAR FILA COMPLETA
// ============================================================================
async function upsertRow(data) {
  try {
    await sheets.replaceOrInsertRow(data);
    return true;
  } catch (err) {
    console.error("❌ [DATA] Error guardando fila Master:", err.message);
    return false;
  }
}

// ============================================================================
// OBTENER ENCABEZADOS DEL MASTER
// ============================================================================
async function getMasterHeaders() {
  try {
    return await sheets.getHeaders();
  } catch (err) {
    console.error("❌ [DATA] Error headers:", err.message);
    return [];
  }
}

module.exports = {
  queryBySKU,
  queryOEM,
  upsertRow,
  getMasterHeaders
};
