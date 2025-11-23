// detectionService.js v4.0.0 — VERSIÓN SÚPER DIAGNÓSTICA
// ============================================================================

const dataAccess = require('./dataAccess');
const utils = require('./utils');

console.log('🟢 [v4.0.0] Iniciando detectionService (MODO DIAGNÓSTICO)...');

let getDonaldsonData, getFRAMData;

try {
  getDonaldsonData = require('./donaldsonScraper').getDonaldsonData;
  getFRAMData = require('./framScraper').getFRAMData;
  console.log('✅ Scrapers cargados');
} catch (error) {
  console.error('❌ Error cargando scrapers:', error.message);
}

// ============================================================================
// FUNCIÓN PRINCIPAL: DETECTAR FILTRO (SÚPER DIAGNÓSTICA)
// ============================================================================
async function detectFilter(queryRaw, sheetsInstance = null) {
  console.log(`\n🔵 ====== INICIO DETECCIÓN DIAGNÓSTICA ======`);
  console.log(`QUERY RECIBIDO: "${queryRaw}"`);
  
  try {
    const query = (queryRaw || '').trim().toUpperCase(); 
    console.log(`QUERY NORMALIZADO: "${query}"`);

    // ========================================================================
    // PASO 1: Google Sheets
    // ========================================================================
    console.log('--- PASO 1: Intentando buscar en Google Sheets ---');
    const sheetMatch = await dataAccess.queryMasterDatabase(query); // Esta función ahora llama a Google Sheets

    if (sheetMatch && sheetMatch.source === 'GOOGLE_SHEETS') {
      console.log('--- ✅ ÉXITO: Encontrado en Google Sheets ---');
      return { status: 'OK', message: 'Found via Google Sheets', source: 'google_sheets', data: sheetMatch.rawData };
    }

    // ========================================================================
    // PASO 2: MongoDB Cache
    // ========================================================================
    console.log('--- PASO 2: No encontrado en Sheets. Buscando en MongoDB Cache ---');
    const dbMatch = await dataAccess.queryMasterDatabase(query); // Esta función también busca en MongoDB

    if (dbMatch && dbMatch.source === 'MONGO_CACHE') {
      console.log('--- ✅ ÉXITO: Encontrado en MongoDB Cache ---');
      return { status: 'OK', message: 'Found via MongoDB Cache', source: 'mongo_cache', data: dbMatch.rawData };
    }

    // ========================================================================
    // PASO 3: No encontrado en ninguna parte
    // ========================================================================
    console.log('--- ❌ FRACASO: No encontrado en Sheets ni en MongoDB ---');
    return {
      status: 'UNKNOWN',
      message: 'The code you entered is incorrect.',
      query_norm: query,
      source: 'none',
      details: 'Not found in Google Sheets or MongoDB Cache.'
    };

  } catch (error) {
    console.error('--- ❌ ERROR CRÍTICO EN DETECCIÓN ---');
    console.error(error.message);
    console.error('--- FIN DEL ERROR ---');
    return { status: 'ERROR', message: 'Internal server error.', query_norm: queryRaw };
  }
}

function setSheetsInstance(instance) {
  console.log('--- Configurando instancia de Sheets (no usada en modo diagnóstico) ---');
}

module.exports = {
  detectFilter,
  setSheetsInstance
};
