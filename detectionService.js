// detectionService.js v3.0.0 — SIN SUPOSICIONES - SOLO DATOS VERIFICABLES
// ============================================================================
// CAMBIOS CRÍTICOS:
// - ELIMINADO: Toda lógica de suposición por prefijos
// - NUEVO: Búsqueda en Google Sheets PRIMERO
// - NUEVO: Scraping como fuente secundaria
// - NUEVO: UNKNOWN cuando no hay datos verificables
// - CORREGIDO: Generación de SKU con código completo
// ============================================================================

let _sheetsInstance = null;

console.log('🟢 [v3.0.0] Iniciando detectionService SIN SUPOSICIONES...');

const normalizeQuery = require('./utils/normalizeQuery');

// Scrapers - solo para búsqueda web cuando no existe en Sheets
let getDonaldsonData, getFRAMData;

try {
  const donaldsonModule = require('./donaldsonScraper');
  getDonaldsonData = donaldsonModule.getDonaldsonData;
  console.log('✅ donaldsonScraper cargado');
} catch (error) {
  console.error('❌ Error cargando donaldsonScraper:', error.message);
  getDonaldsonData = async () => ({ found: false });
}

try {
  const framModule = require('./framScraper');
  getFRAMData = framModule.getFRAMData;
  console.log('✅ framScraper cargado');
} catch (error) {
  console.error('❌ Error cargando framScraper:', error.message);
  getFRAMData = async () => ({ found: false });
}

// ============================================================================
// PREFIJOS DE SKU POR TIPO (Solo para generación, NO para detección)
// ============================================================================
const SKU_PREFIXES = {
  'OIL': 'EL8',
  'LUBE': 'EL8',
  'AIR': 'EA',
  'FUEL': 'EF',
  'HYDRAULIC': 'EH6',
  'COOLANT': 'EW7',
  'CABIN': 'EC1',
  'AIR_DRYER': 'ED4',
  'TURBINE': 'ET9',
  'UNKNOWN': 'EXX'
};

// ============================================================================
// FUNCIÓN PRINCIPAL: DETECTAR FILTRO
// ============================================================================
async function detectFilter(queryRaw, sheetsInstance = null) {
  console.log(`\n🔵 ====== INICIO DETECCIÓN v3.0.0: ${queryRaw} ======`);
  
  try {
    // PASO 1: Normalizar query
    console.log('📝 [1/5] Normalizando query...');
    const query = normalizeQuery(queryRaw);
    console.log(`✅ Query normalizado: "${query}"`);
    
    const sheets = sheetsInstance || _sheetsInstance;
    
    // PASO 2: BUSCAR EN GOOGLE SHEETS PRIMERO (FUENTE PRIMARIA)
    console.log('🔍 [2/5] Buscando en Google Sheets (fuente primaria)...');
    
    if (sheets && sheets.findExactCode) {
      try {
        const sheetData = await sheets.findExactCode(query);
        
        if (sheetData) {
          console.log(`✅ ENCONTRADO EN SHEETS: SKU ${sheetData.sku}`);
          console.log(`📊 Tipo: ${sheetData.filter_type}, Duty: ${sheetData.duty}`);
          
          // Retornar datos del Sheet directamente (DATOS VERIFICADOS)
          const result = {
            status: 'OK',
            from_cache: false,
            source: 'google_sheets',
            query_norm: query,
            sku: sheetData.sku || 'EXX0000',
            filter_type: sheetData.filter_type || 'UNKNOWN',
            duty: sheetData.duty || 'UNKNOWN',
            oem_code: sheetData.oem_code || query,
            source_code: sheetData.source_code || query,
            cross_reference: parseArray(sheetData.cross_reference),
            oem_codes: parseArray(sheetData.oem_codes),
            engine_applications: parseArray(sheetData.engine_applications),
            equipment_applications: parseArray(sheetData.equipment_applications),
            specs: parseSpecs(sheetData.specs),
            description: sheetData.description || '',
            created_at: sheetData.created_at || new Date().toISOString()
          };
          
          console.log(`🔵 ====== FIN DETECCIÓN v3.0.0 (FROM SHEETS) ======\n`);
          return result;
        } else {
          console.log('⚠️ No encontrado en Sheets, continuando con scraping...');
        }
      } catch (err) {
        console.error('❌ Error buscando en Sheets:', err.message);
      }
    } else {
      console.log('⚠️ Google Sheets no disponible, saltando a scraping...');
    }
    
    // PASO 3: SCRAPING WEB (FUENTE SECUNDARIA)
    console.log('🌐 [3/5] Buscando en web (fuente secundaria)...');
    
    let webData = null;
    let scrapedFrom = null;
    
    // Intentar Donaldson primero
    try {
      console.log('🔍 Intentando Donaldson...');
      const donaldsonResult = await getDonaldsonData(query);
      
      if (donaldsonResult && donaldsonResult.found) {
        console.log('✅ ENCONTRADO EN DONALDSON');
        webData = donaldsonResult;
        scrapedFrom = 'donaldson';
      }
    } catch (err) {
      console.error('❌ Error scrapeando Donaldson:', err.message);
    }
    
    // Si no encontró en Donaldson, intentar FRAM
    if (!webData) {
      try {
        console.log('🔍 Intentando FRAM...');
        const framResult = await getFRAMData(query);
        
        if (framResult && framResult.found) {
          console.log('✅ ENCONTRADO EN FRAM');
          webData = framResult;
          scrapedFrom = 'fram';
        }
      } catch (err) {
        console.error('❌ Error scrapeando FRAM:', err.message);
      }
    }
    
    // PASO 4: PROCESAR DATOS DE WEB
    if (webData && webData.filter_type) {
      console.log('📊 [4/5] Procesando datos de web...');
      console.log(`✅ Tipo encontrado: ${webData.filter_type}`);
      
      // Generar SKU CORRECTO con código completo
      const sku = generateCorrectSKU(webData.filter_type, query);
      console.log(`✅ SKU generado: ${sku}`);
      
      const result = {
        status: 'OK',
        from_cache: false,
        source: scrapedFrom,
        query_norm: query,
        sku: sku,
        filter_type: webData.filter_type,
        duty: webData.duty || 'HD',
        oem_code: query,
        source_code: webData.source_code || query,
        cross_reference: cleanArray(webData.cross_references || [], 10),
        oem_codes: cleanArray(webData.oem_codes || [], 10),
        engine_applications: cleanArray(webData.engine_applications || [], 10),
        equipment_applications: cleanArray(webData.equipment_applications || [], 10),
        specs: webData.specs || {},
        description: webData.description || generateDefaultDescription(sku, webData.filter_type),
        created_at: new Date().toISOString()
      };
      
      // PASO 5: GUARDAR EN SHEETS PARA PRÓXIMA VEZ
      console.log('💾 [5/5] Guardando en Google Sheets...');
      if (sheets && sheets.saveNewFilter) {
        try {
          await sheets.saveNewFilter(result);
          console.log('✅ Guardado en Sheet MASTER');
        } catch (err) {
          console.error('❌ Error guardando en Sheets:', err.message);
        }
      }
      
      console.log(`🔵 ====== FIN DETECCIÓN v3.0.0 (FROM WEB) ======\n`);
      return result;
    }
    
    // PASO 5: NO ENCONTRADO - RETORNAR UNKNOWN
    console.log('⚠️ [4/5] Código no encontrado en ninguna fuente');
    
    // Guardar en UNKNOWN sheet
    if (sheets && sheets.saveUnknown) {
      try {
        await sheets.saveUnknown(query);
        console.log('✅ Guardado en Sheet UNKNOWN');
      } catch (err) {
        console.error('❌ Error guardando en UNKNOWN:', err.message);
      }
    }
    
    console.log(`🔵 ====== FIN DETECCIÓN v3.0.0 (UNKNOWN) ======\n`);
    
    return {
      status: 'UNKNOWN',
      message: 'Filter code not found in database or verified web sources',
      query_norm: query,
      sku: 'UNKNOWN',
      filter_type: 'UNKNOWN',
      duty: 'UNKNOWN',
      oem_code: query,
      source: 'none',
      cross_reference: [],
      oem_codes: [],
      engine_applications: [],
      equipment_applications: [],
      specs: {},
      description: `El código ${query} no fue encontrado en nuestra base de datos. Por favor contacte a nuestro equipo.`,
      created_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ ERROR CRÍTICO EN DETECCIÓN:`, error.message);
    console.error(error.stack);
    
    return {
      status: 'ERROR',
      message: error.message,
      query_norm: queryRaw,
      sku: 'ERROR',
      filter_type: 'UNKNOWN',
      duty: 'UNKNOWN',
      oem_code: queryRaw,
      source: 'error',
      cross_reference: [],
      oem_codes: [],
      engine_applications: [],
      equipment_applications: [],
      specs: {},
      description: 'Error al procesar la búsqueda. Por favor intente nuevamente.',
      created_at: new Date().toISOString()
    };
  }
}

// ============================================================================
// GENERAR SKU CORRECTO (USA CÓDIGO COMPLETO, NO SOLO 4 DÍGITOS)
// ============================================================================
function generateCorrectSKU(filterType, code) {
  // Normalizar tipo
  const type = (filterType || 'UNKNOWN').toUpperCase().trim();
  
  // Obtener prefijo
  const prefix = SKU_PREFIXES[type] || SKU_PREFIXES['UNKNOWN'];
  
  // Extraer TODOS los dígitos del código
  const digits = code.replace(/\D/g, '');
  
  if (digits.length === 0) {
    console.log('⚠️ [SKU] No se encontraron dígitos en el código');
    return prefix + '0000';
  }
  
  // USAR CÓDIGO COMPLETO, NO SOLO 4 DÍGITOS
  const sku = prefix + digits;
  
  console.log(`✅ [SKU] ${type} + ${digits} → ${sku}`);
  return sku;
}

// ============================================================================
// UTILIDADES
// ============================================================================

function cleanArray(arr, max = 10) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, max);
}

function parseArray(str) {
  if (!str) return [];
  if (Array.isArray(str)) return str;
  if (typeof str === 'string') {
    return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
  return [];
}

function parseSpecs(specs) {
  if (!specs) return {};
  if (typeof specs === 'object') return specs;
  if (typeof specs === 'string') {
    try {
      return JSON.parse(specs);
    } catch {
      return {};
    }
  }
  return {};
}

function generateDefaultDescription(sku, type) {
  const typeNames = {
    'OIL': 'aceite',
    'LUBE': 'aceite',
    'AIR': 'aire',
    'FUEL': 'combustible',
    'HYDRAULIC': 'hidráulico',
    'COOLANT': 'refrigerante',
    'CABIN': 'cabina'
  };
  
  const typeName = typeNames[type] || 'filtro';
  
  return `El ${sku} es un filtro de ${typeName} de alta calidad para aplicaciones industriales, fabricado bajo estándares OEM. / The ${sku} is a high-quality ${type.toLowerCase()} filter for industrial applications, manufactured to OEM standards.`;
}

function setSheetsInstance(instance) {
  _sheetsInstance = instance;
  console.log('✅ Google Sheets instance configurada');
}

console.log('✅ [v3.0.0] detectionService.js READY - SIN SUPOSICIONES');

module.exports = { 
  detectFilter, 
  setSheetsInstance,
  generateCorrectSKU
};
