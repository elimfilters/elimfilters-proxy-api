// detectionService.js v4.0.0 — INTEGRACIÓN MONGO + SCRAPING + SHEETS
// ============================================================================
// CAMBIOS CRÍTICOS:
// - NUEVO: Implementa 3 niveles de búsqueda: Sheets -> Mongo Cache -> Scraping
// - NUEVO: Lógica de guardado en Mongo Cache para persistencia de scrapers
// ============================================================================

let _sheetsInstance = null;
const dataAccess = require('./dataAccess'); // Importación de la capa de DB/Sheets
const utils = require('./utils');             // Importación de utilidades (limpieza, normalización)

console.log('🟢 [v4.0.0] Iniciando detectionService con 3 niveles...');

// Scrapers - importados solo para ser usados en la lógica de scraping
let getDonaldsonData, getFRAMData;

try {
  getDonaldsonData = require('./donaldsonScraper').getDonaldsonData;
  getFRAMData = require('./framScraper').getFRAMData;
  console.log('✅ Scrapers de Donaldson/FRAM cargados');
} catch (error) {
  console.error('❌ Error cargando módulos de Scraper (revisar dependencias):', error.message);
  getDonaldsonData = async () => ({ found: false });
  getFRAMData = async () => ({ found: false });
}


// ============================================================================
// LÓGICA DE UTILIDAD
// ============================================================================

/**
 * Mueve la lógica de determineDutyLevel de scraperService para simplificar el flujo.
 */
function determineDutyLevel(code) {
    const hdPrefixes = ['CAT', 'CUM', 'DETROIT', 'P55', '1R', 'LF', 'AF', 'FF', 'BF', 'PA'];
    const ldPrefixes = ['PH', 'CA', 'CH', 'FS', 'CS', 'WIX', 'FL', 'MO']; 

    const codeUpper = code.toUpperCase();
    
    if (codeUpper.startsWith('P') && codeUpper.length === 7 && !isNaN(parseInt(codeUpper.substring(1)))) {
        return 'HD';
    }

    for (const prefix of hdPrefixes) {
        if (codeUpper.startsWith(prefix)) return 'HD';
    }
    for (const prefix of ldPrefixes) {
        if (codeUpper.startsWith(prefix)) return 'LD';
    }

    return 'LD'; // Fallback a ligero
}

// ============================================================================
// FUNCIÓN PRINCIPAL: DETECTAR FILTRO
// ============================================================================
async function detectFilter(queryRaw, sheetsInstance = null) {
  console.log(`\n🔵 ====== INICIO DETECCIÓN v4.0.0: ${queryRaw} ======`);
  let query, result;
  
  try {
    // PASO 1: Normalizar query (Usando la utilidad de normalización de query)
    console.log('📝 [1/5] Normalizando query...');
    // Asumimos que normalizeQuery es una función en utils o un módulo aparte
    query = (queryRaw || '').trim().toUpperCase(); 
    console.log(`✅ Query normalizado: "${query}"`);

    // ========================================================================
    // Nivel 1: Google Sheets (Fuente Primaria, Máxima Confianza)
    // ========================================================================
    console.log('🔍 [2/5] Buscando en Google Sheets (fuente primaria)...');
    try {
        if (sheetsInstance && sheetsInstance.findExactCode) {
            const sheetData = await sheetsInstance.findExactCode(query);
            
            if (sheetData) {
                console.log(`✅ ENCONTRADO EN SHEETS: SKU ${sheetData.sku}`);
                return formatResponse(sheetData, query, 'google_sheets');
            }
        }
    } catch (err) {
        console.error('❌ Error buscando en Sheets:', err.message);
    }
    
    // ========================================================================
    // Nivel 2: MongoDB Cache (Fuente Secundaria, Alta Confianza)
    // ========================================================================
    console.log('🔍 [3/5] Buscando en MongoDB Cache...');
    const dbMatch = await dataAccess.queryMasterDatabase(query); // queryMasterDatabase ahora busca en Mongo también

    if (dbMatch && dbMatch.source === 'MONGO_CACHE') {
        console.log(`✅ ENCONTRADO EN CACHE: Código ${dbMatch.rawData.priority_reference}`);
        // Utilizamos el mapeo de rawData que ya está en dataAccess
        return formatResponse(dbMatch.rawData, query, 'mongo_cache');
    }

    // ========================================================================
    // Nivel 3: Scraping Web (Fuente de Último Recurso, Guardar en Caché)
    // ========================================================================
    console.log('🌐 [4/5] No encontrado en BD. Iniciando Scraping...');
    
    const dutyLevel = determineDutyLevel(query);
    let scraperResult = { found: false, filter_type: 'UNKNOWN' };

    if (dutyLevel === 'HD') {
        scraperResult = await getDonaldsonData(query);
        scraperResult.source = 'DONALDSON_SCRAPER';
    } else {
        scraperResult = await getFRAMData(query);
        scraperResult.source = 'FRAM_SCRAPER';
    }

    if (scraperResult.found) {
        // --- 4.1: Mapeo y Normalización de Datos Scrapeados ---
        const primaryCode = scraperResult.fram_code || scraperResult.donaldson_code;
        const filterType = scraperResult.attributes.type || scraperResult.attributes.product_type || 'UNKNOWN';

        const rawDataToSave = {
            priority_reference: primaryCode,
            duty_level: dutyLevel,
            filter_family: filterType.toUpperCase(),
            specs: scraperResult.attributes,
            cross_reference: scraperResult.cross_references,
            equipment_applications: scraperResult.equipment_applications,
        };
        
        // --- 4.2: Guardar en MongoDB Cache (Persistencia) ---
        console.log('💾 Guardando en MongoDB Cache...');
        const saveResult = await dataAccess.saveScrapedData({
            rawData: rawDataToSave,
            source: scraperResult.source
        });

        if (saveResult) {
            console.log('✅ Guardado en MongoDB Cache');
            // Devolvemos la respuesta formateada con los datos guardados
            return formatResponse(saveResult.rawData, query, saveResult.source);
        }
    }

    // ========================================================================
    // Nivel 4: NO ENCONTRADO
    // ========================================================================
    console.log('⚠️ [4/5] Código no encontrado en ninguna fuente verificable.');
    
    // Aquí puedes añadir la lógica para guardar el código en una hoja 'UNKNOWN' si lo necesitas.
    
    return {
        status: 'UNKNOWN',
        message: 'Filter code not found in database or verified web sources',
        query_norm: query,
        sku: 'UNKNOWN',
        filter_type: 'UNKNOWN',
        duty: 'UNKNOWN',
        oem_code: query,
        source: 'none',
        description: `El código ${query} no fue encontrado.`,
    };

  } catch (error) {
    console.error(`❌ ERROR CRÍTICO EN DETECCIÓN:`, error.message);
    return { status: 'ERROR', message: 'Error interno del servidor.', query_norm: queryRaw };
  } finally {
    console.log(`🔵 ====== FIN DETECCIÓN v4.0.0 ======\n`);
  }
}

// ============================================================================
// FUNCIÓN DE FORMATO Y CONSTRUCCIÓN DE RESPUESTA
// Se necesita para estandarizar la salida de Sheets, Mongo y Scraper
// ============================================================================

function generateCorrectSKU(filterType, code) {
    const SKU_PREFIXES = { 'OIL': 'EL8', 'LUBE': 'EL8', 'AIR': 'EA1', 'FUEL': 'EF9', 'HYDRAULIC': 'EH6', 'CABIN': 'EC1', 'UNKNOWN': 'EXX' };
    const type = (filterType || 'UNKNOWN').toUpperCase().trim();
    const prefix = SKU_PREFIXES[type] || SKU_PREFIXES['UNKNOWN'];
    const digits = code.replace(/\D/g, '');
    if (digits.length === 0) return prefix + '0000';
    return prefix + digits;
}

function formatResponse(rawData, queryNorm, source) {
    const filterType = rawData.filter_type || rawData.filter_family || 'UNKNOWN';
    const duty = rawData.duty || rawData.duty_level || 'UNKNOWN';
    const sku = generateCorrectSKU(filterType, queryNorm);
    const description = rawData.description || utils.generateDefaultDescription(sku, filterType, duty);

    // Las utilidades de limpieza ya las definiste en utils.js
    const parseArray = utils.cleanArray; // o la función que uses para arrays

    return {
        status: 'OK',
        from_cache: source.includes('cache') || source.includes('sheets'),
        source: source,
        query_norm: queryNorm,
        sku: sku,
        filter_type: filterType,
        duty: duty,
        oem_code: rawData.oem_code || queryNorm,
        source_code: rawData.priority_reference || queryNorm,
        cross_reference: parseArray(rawData.cross_reference || rawData.cross_references), // Maneja las dos nomenclaturas
        equipment_applications: parseArray(rawData.equipment_applications),
        specs: rawData.specs || {},
        description: description,
        created_at: rawData.created_at || new Date().toISOString()
    };
}


function setSheetsInstance(instance) {
  _sheetsInstance = instance;
  console.log('✅ Google Sheets instance configurada');
}

module.exports = {
  detectFilter,
  setSheetsInstance,
  generateCorrectSKU,
  determineDutyLevel // Exportado por si se necesita externamente
};
