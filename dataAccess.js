// ============================================================================
// ELIMFILTERS — DATA ACCESS LAYER (Google Sheets + MongoDB)
// ============================================================================
const sheets = require("./googleSheetsConnector");
const rulesProtection = require("./rulesProtection");
const Filter = require("./filterModel"); // Importamos el molde de MongoDB

// ============================================================================
// NORMALIZAR COLUMNAS VACÍAS
// ============================================================================
function clean(obj) {
  const out = {};
  for (const k in obj) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
      out[k] = obj[k];
    }
  }
  return out;
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE BÚSQUEDA (NUEVA)
// Busca en MongoDB Cache primero, si no encuentra, busca en Sheets.
// ============================================================================
async function queryMasterDatabase(query) {
  console.log(`🔍 [MongoDB] Buscando en caché para: ${query}`);
  
  // 1. Buscar en MongoDB Cache
  const cachedFilter = await Filter.findOne({ priority_reference: query }).lean();
  if (cachedFilter) {
    console.log(`✅ [MongoDB] Encontrado en caché: ${query}`);
    return { source: 'MONGO_CACHE', rawData: cachedFilter };
  }

  console.log(`⚠️ [MongoDB] No encontrado en caché. Buscando en Sheets...`);
  
  // 2. Si no está en caché, buscar en Google Sheets
  const sheetRow = await sheets.findRowByQueryNorm(query);
  if (sheetRow) {
    console.log(`✅ [Sheets] Encontrado en hoja de cálculo: ${query}`);
    return { source: 'GOOGLE_SHEETS', rawData: sheetRow };
  }

  // 3. Si no está en ninguna parte, devolver null
  console.log(`❌ [DataAccess] No encontrado en ninguna fuente.`);
  return null;
}

// ============================================================================
// FUNCIÓN PARA GUARDAR DATOS SCRAPEADOS (NUEVA)
// ============================================================================
async function saveScrapedData({ rawData, source }) {
  console.log(`💾 [MongoDB] Guardando datos scrapeados de ${source}...`);
  try {
    const newFilter = new Filter({
      ...rawData,
      source: source
    });
    const savedFilter = await newFilter.save();
    console.log(`✅ [MongoDB] Guardado exitosamente en caché.`);
    return { source: source, rawData: savedFilter.toObject() };
  } catch (error) {
    console.error(`❌ [MongoDB] Error al guardar en caché:`, error.message);
    return null;
  }
}


// ============================================================================
// FUNCIONES ANTIGUAS DE GOOGLE SHEETS (Se mantienen por si se usan en otro lado)
// ============================================================================
async function queryBySKU(sku) {
  const row = await sheets.findRowBySKU(sku);
  return row || null;
}

async function queryByOEMorCross(code) {
  return await sheets.findRowByOEM(code);
}

async function saveFullRecord(record) {
  if (!record || !record.query_norm) {
    throw new Error("saveFullRecord requiere query_norm");
  }

  const cleanRecord = clean(record);
  const existing = await sheets.findRowByQueryNorm(record.query_norm);

  let finalRecord = null;
  let changed = false;

  if (existing) {
    const { record: merged, changed: diff } = rulesProtection.applyProtectionRules(
      existing,
      cleanRecord
    );
    finalRecord = merged;
    changed = diff;
    await sheets.updateRow(existing._rowIndex, finalRecord);
  } else {
    finalRecord = cleanRecord;
    await sheets.insertRow(finalRecord);
    changed = true;
  }

  return { ok: true, changed, record: finalRecord };
}

async function logUnknownCode(code) {
  try {
    await sheets.saveUnknownCode(code);
    return true;
  } catch (e) {
    console.error("[dataAccess] Error guardando unknown code:", e);
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  queryMasterDatabase, // La nueva función principal
  saveScrapedData,      // La nueva función para guardar
  queryBySKU,
  queryByOEMorCross,
  saveFullRecord,
  logUnknownCode
};
