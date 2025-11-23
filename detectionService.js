// detectionService.js v4.0.0 — INTEGRACIÓN MONGO + SCRAPING + SHEETS (CON DIAGNÓSTICO)
// ============================================================================

let _sheetsInstance = null;
const dataAccess = require('./dataAccess');
const utils = require('./utils');

console.log('🟢 [v4.0.0] Iniciando detectionService con 3 niveles...');

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

function determineDutyLevel(code) {
    const hdPrefixes = ['CAT', 'CUM', 'DETROIT', 'P55', '1R', 'LF', 'AF', 'FF', 'BF', 'PA'];
    const ldPrefixes = ['PH', 'CA', 'CH', 'FS', 'CS', 'WIX', 'FL', 'MO']; 
    const codeUpper = code.toUpperCase();
    if (codeUpper.startsWith('P') && codeUpper.length === 7 && !isNaN(parseInt(codeUpper.substring(1)))) return 'HD';
    for (const prefix of hdPrefixes) if (codeUpper.startsWith(prefix)) return 'HD';
    for (const prefix of ldPrefixes) if (codeUpper.startsWith(prefix)) return 'LD';
    return 'LD';
}

// ============================================================================
// FUNCIÓN PRINCIPAL: DETECTAR FILTRO (CON DIAGNÓSTICO)
// ============================================================================
async function detectFilter(queryRaw, sheetsInstance = null) {
  console.log(`\n🔵 ====== INICIO DETECCIÓN v4.0.0: ${queryRaw} ======`);
  let query, result;
  
  try {
    query = (queryRaw || '').trim().toUpperCase(); 
    console.log(`✅ Query normalizado: "${query}"`);

    // ========================================================================
    // Nivel 1: Google Sheets (Fuente Primaria, Máxima Confianza)
    // ========================================================================
    console.log('🔍 [2/5] Buscando en Google Sheets (fuente primaria)...');
    try {
        // Comprobamos si la instancia y la función existen antes de llamarlas
        if (sheetsInstance && typeof sheetsInstance.findRowByQueryNorm === 'function') {
            const sheetData = await sheetsInstance.findRowByQueryNorm(query);
            if (sheetData) {
                console.log(`✅ ENCONTRADO EN SHEETS: SKU ${sheetData.sku}`);
                return formatResponse(sheetData, query, 'google_sheets');
            }
        } else {
            console.warn('⚠️ [DIAG] La instancia de Sheets o la función findRowByQueryNorm no están disponibles.');
        }
    } catch (err) {
        console.error('❌ [DIAG] Error buscando en Sheets:', err.message);
    }
    
    // ========================================================================
    // Nivel 2: MongoDB Cache (Fuente Secundaria, Alta Confianza)
    // ========================================================================
    console.log('🔍 [3/5] Buscando en MongoDB Cache...');
    try {
        const dbMatch = await dataAccess.queryMasterDatabase(query);
        if (dbMatch) {
            console.log(`✅ ENCONTRADO EN CACHE: Código ${dbMatch.rawData.priority_reference}`);
            return formatResponse(dbMatch.rawData, query, dbMatch.source);
        }
    } catch (err) {
        console.error('❌ [DIAG] Error buscando en MongoDB Cache:', err.message);
    }

    // ========================================================================
    // Nivel 3: Scraping Web (Fuente de Último Recurso, Guardar en Caché)
    // ========================================================================
    console.log('🌐 [4/5] No encontrado en BD. Iniciando Scraping...');
    
    const dutyLevel = determineDutyLevel(query);
    let scraperResult = { found: false, filter_type: 'UNKNOWN' };

    try {
        if (dutyLevel === 'HD') {
            scraperResult = await getDonaldsonData(query);
            scraperResult.source = 'DONALDSON_SCRAPER';
        } else {
            scraperResult = await getFRAMData(query);
            scraperResult.source = 'FRAM_SCRAPER';
        }
    } catch (err) {
        console.error('❌ [DIAG] Error durante el scraping:', err.message);
    }

    if (scraperResult.found) {
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
        
        try {
            console.log('💾 Guardando en MongoDB Cache...');
            const saveResult = await dataAccess.saveScrapedData({ rawData: rawDataToSave, source: scraperResult.source });
            if (saveResult) {
                console.log('✅ Guardado en MongoDB Cache');
                return formatResponse(saveResult.rawData, query, saveResult.source);
            }
        } catch (err) {
            console.error('❌ [DIAG] Error guardando en MongoDB Cache:', err.message);
        }
    }

    // ========================================================================
    // Nivel 4: NO ENCONTRADO (MENSAJE CORREGIDO)
    // ========================================================================
    console.log('⚠️ [5/5] Código no encontrado en ninguna fuente verificable.');
    return {
        status: 'UNKNOWN',
        message: 'El código que ingreso es incorrecto', // <-- MENSAJE CAMBIADO
        query_norm: query,
        sku: 'UNKNOWN',
        filter_type: 'UNKNOWN',
        duty: 'UNKNOWN',
        oem_code: query,
        source: 'none',
        description: `El código ${query} que ingreso es incorrecto.`, // <-- DESCRIPCIÓN CAMBIADA
    };

  } catch (error) {
    // Este es el catch final. Si llegamos aquí, es un error grave.
    console.error(`❌ [DIAG] ERROR CRÍTICO EN DETECCIÓN:`, error.message);
    console.error(error); // Imprime el objeto de error completo
    return { status: 'ERROR', message: 'Error interno del servidor.', query_norm: queryRaw };
  } finally {
    console.log(`🔵 ====== FIN DETECCIÓN v4.0.0 ======\n`);
  }
}

// ============================================================================
// FUNCIÓN DE FORMATO Y CONSTRUCCIÓN DE RESPUESTA
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
    const parseArray = utils.cleanArray;
    return {
        status: 'OK', from_cache: source.includes('cache') || source.includes('sheets'), source: source, query_norm: queryNorm, sku: sku, filter_type: filterType, duty: duty, oem_code: rawData.oem_code || queryNorm, source_code: rawData.priority_reference || queryNorm, cross_reference: parseArray(rawData.cross_reference || rawData.cross_references), equipment_applications: parseArray(rawData.equipment_applications), specs: rawData.specs || {}, description: description, created_at: rawData.created_at || new Date().toISOString()
    };
}

function setSheetsInstance(instance) {
  _sheetsInstance = instance;
  console.log('✅ Google Sheets instance configurada');
}

module.exports = { detectFilter, setSheetsInstance, generateCorrectSKU, determineDutyLevel };
