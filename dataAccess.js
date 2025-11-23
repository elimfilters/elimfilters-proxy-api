// ============================================================================
// ELIMFILTERS — DATA ACCESS LAYER (Google Sheets + MongoDB)
// ============================================================================
const sheets = require("./googleSheetsConnector"); // Importamos el conector NUEVO
const Filter = require("./filterModel"); // El modelo de MongoDB

// ============================================================================
// FUNCIÓN PRINCIPAL DE BÚSQUEDA (CORREGIDA PARA USAR LA NUEVA HERRAMIENTA)
// ============================================================================
async function queryMasterDatabase(query) {
  console.log(`🔍 [DataAccess] Buscando con la nueva función findExactCode para: ${query}`);
  
  // 1. Buscar en Google Sheets con la FUNCIÓN NUEVA Y CORRECTA
  const sheetMatch = await sheets.findExactCode(query);
  if (sheetMatch) {
    console.log(`✅ [DataAccess] Encontrado en Sheets: ${sheetMatch.sku}`);
    return { source: 'GOOGLE_SHEETS', rawData: sheetMatch };
  }

  console.log(`⚠️ [DataAccess] No encontrado en Sheets. Buscando en MongoDB Cache...`);
  
  // 2. Si no está en Sheets, buscar en MongoDB Cache
  const cachedFilter = await Filter.findOne({ priority_reference: query }).lean();
  if (cachedFilter) {
    console.log(`✅ [DataAccess] Encontrado en MongoDB Cache: ${query}`);
    return { source: 'MONGO_CACHE', rawData: cachedFilter };
  }

  // 3. Si no está en ninguna parte, devolver null
  console.log(`❌ [DataAccess] No encontrado en ninguna fuente.`);
  return null;
}

// ============================================================================
// FUNCIÓN PARA GUARDAR DATOS SCRAPEADOS (SIN CAMBIOS)
// ============================================================================
async function saveScrapedData({ rawData, source }) {
  console.log(`💾 [DataAccess] Guardando datos scrapeados de ${source}...`);
  try {
    const newFilter = new Filter({
      ...rawData,
      source: source
    });
    const savedFilter = await newFilter.save();
    console.log(`✅ [DataAccess] Guardado en MongoDB Cache.`);
    return { source: source, rawData: savedFilter.toObject() };
  } catch (error) {
    console.error(`❌ [DataAccess] Error al guardar en caché:`, error.message);
    return null;
  }
}

// ============================================================================
// EXPORTS (Solo exportamos lo que realmente se usa)
// ============================================================================
module.exports = {
  queryMasterDatabase, // La función principal corregida
  saveScrapedData,      // La función para guardar
};
