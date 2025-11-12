// detectionService.js v4.0.1-DEBUG — CON LOGGING EXTENSIVO
let _sheetsInstance = null;

console.log('🟢 [DEBUG] Iniciando carga de módulos...');

const normalizeQuery = require('./utils/normalizeQuery');
console.log('✅ [DEBUG] normalizeQuery cargado');

const { findEquivalence } = require('./crossReferenceDB');
console.log('✅ [DEBUG] crossReferenceDB cargado');

// Scrapers - con manejo de errores
let getDonaldsonData, getFRAMData, cleanArray, formatEngineApplication, formatEquipmentApplication, combineWithDefaults, generateDefaultDescription;

try {
  console.log('🔍 [DEBUG] Intentando cargar donaldsonScraper...');
  const donaldsonModule = require('./scrapers/donaldsonScraper');
  getDonaldsonData = donaldsonModule.getDonaldsonData;
  console.log('✅ [DEBUG] donaldsonScraper cargado');
} catch (error) {
  console.error('❌ [DEBUG] Error cargando donaldsonScraper:', error.message);
  getDonaldsonData = async () => ({ found: false, cross_references: [], oem_codes: [], engine_applications: [], equipment_applications: [], specs: {}, description: '' });
}

try {
  console.log('🔍 [DEBUG] Intentando cargar framScraper...');
  const framModule = require('./scrapers/framScraper');
  getFRAMData = framModule.getFRAMData;
  console.log('✅ [DEBUG] framScraper cargado');
} catch (error) {
  console.error('❌ [DEBUG] Error cargando framScraper:', error.message);
  getFRAMData = async () => ({ found: false, cross_references: [], oem_codes: [], engine_applications: [], equipment_applications: [], specs: {}, description: '' });
}

try {
  console.log('🔍 [DEBUG] Intentando cargar scrapers/utils...');
  const utilsModule = require('./scrapers/utils');
  cleanArray = utilsModule.cleanArray || ((arr, max) => (arr || []).slice(0, max || 10));
  formatEngineApplication = utilsModule.formatEngineApplication || (text => text);
  formatEquipmentApplication = utilsModule.formatEquipmentApplication || (text => text);
  combineWithDefaults = utilsModule.combineWithDefaults || ((data) => data);
  generateDefaultDescription = utilsModule.generateDefaultDescription || ((sku, family, duty) => `Filter ${sku} ${family} ${duty}`);
  console.log('✅ [DEBUG] scrapers/utils cargado');
} catch (error) {
  console.error('❌ [DEBUG] Error cargando scrapers/utils:', error.message);
  cleanArray = (arr, max) => (arr || []).slice(0, max || 10);
  formatEngineApplication = text => text;
  formatEquipmentApplication = text => text;
  combineWithDefaults = (data) => data;
  generateDefaultDescription = (sku, family, duty) => `Filter ${sku} ${family} ${duty}`;
}

console.log('✅ [DEBUG] Todos los módulos procesados');

const OEM_MANUFACTURERS = [
  'CATERPILLAR', 'KOMATSU', 'CUMMINS', 'VOLVO', 'MACK', 'JOHN DEERE',
  'DETROIT DIESEL', 'PERKINS', 'CASE', 'NEW HOLLAND', 'SCANIA',
  'MERCEDES TRUCK', 'KENWORTH', 'PETERBILT', 'FREIGHTLINER',
  'INTERNATIONAL', 'MTU', 'PACCAR', 'HINO', 'IVECO',
];

const CROSS_MANUFACTURERS = [
  'DONALDSON', 'BALDWIN', 'FRAM', 'FLEETGUARD', 'WIX', 'PUROLATOR',
  'MAN', 'PARKER', 'HENGST', 'KNECHT', 'CHAMPION', 'MANN',
];

const FAMILY_RULES = {
  AIR: { patterns: ['AIR', 'CA', 'CF', 'RS', 'EAF', 'P1', 'AF'], prefix: 'EA1' },
  OIL: { patterns: ['OIL', '1R', 'PH', 'LF', 'B', 'BT'], prefix: 'EL8' },
  FUEL: { patterns: ['FUEL', 'FF', 'FS', 'P77', 'P52'], prefix: 'EF9' },
  CABIN: { patterns: ['CABIN', 'AC', 'A/C', 'CUK', 'CU'], prefix: 'EC1' },
  HYDRAULIC: { patterns: ['HYDRAULIC', 'HF', 'H'], prefix: 'EH6' },
  COOLANT: { patterns: ['COOLANT', 'REFRIGERANTE'], prefix: 'EW7' },
  AIR_DRYER: { patterns: ['DRYER', 'SECANTE'], prefix: 'ED4' },
  TURBINE: { patterns: ['TURBINA', 'PARKER'], prefix: 'ET9' },
  HOUSING: { patterns: ['HOUSING', 'CARCASA'], prefix: 'EA2' },
  KIT_DIESEL: { patterns: ['DIESEL KIT', 'KIT DIESEL'], prefix: 'EK5' },
  KIT_GASOLINE: { patterns: ['GASOLINE KIT', 'KIT GASOLINA'], prefix: 'EK3' },
};

function isAlreadyCrossReference(query) {
  const q = query.toUpperCase().replace(/[-\s]/g, '');
  
  if (/^P\d{6}/.test(q)) {
    return { brand: 'DONALDSON', duty: 'HD', partNumber: q };
  }
  
  if (/^(PH|CA|CS|FS|CH|BG|G)\d{4,}/.test(q)) {
    return { brand: 'FRAM', duty: 'LD', partNumber: q };
  }
  
  if (/^CF\d{5}/.test(q)) {
    return { brand: 'FRAM', duty: 'LD', partNumber: q };
  }
  
  if (/^(LF|FF|AF|HF)\d{4,}/.test(q)) {
    return { brand: 'FLEETGUARD', duty: 'HD', partNumber: q };
  }
  
  if (/^(B|BT|PA)\d{3,}/.test(q)) {
    return { brand: 'BALDWIN', duty: 'HD', partNumber: q };
  }
  
  if (/^(CUK|CU)\d{4}/.test(q)) {
    return { brand: 'MANN', duty: 'LD', partNumber: q };
  }
  
  return null;
}

function detectFamily(query) {
  const q = query.toUpperCase();
  for (const [family, { patterns }] of Object.entries(FAMILY_RULES)) {
    if (patterns.some(p => q.includes(p))) return family;
  }
  return 'UNKNOWN';
}

function detectDuty(query, family) {
  const q = query.toUpperCase();
  
  const crossRef = isAlreadyCrossReference(q);
  if (crossRef) return crossRef.duty;
  
  if (OEM_MANUFACTURERS.some(m => q.includes(m))) return 'HD';
  if (['TOYOTA', 'FORD', 'NISSAN', 'MAZDA', 'LEXUS', 'BMW', 'MERCEDES', 'AUDI', 'PORSCHE', 'VOLKSWAGEN'].some(m => q.includes(m))) return 'LD';
  if (['KIT_DIESEL', 'HYDRAULIC', 'TURBINE', 'AIR_DRYER'].includes(family)) return 'HD';
  return 'UNKNOWN';
}

function detectSource(query) {
  const q = query.toUpperCase();
  
  const crossRef = isAlreadyCrossReference(q);
  if (crossRef) return crossRef.brand;
  
  if (CROSS_MANUFACTURERS.some(m => q.includes(m))) return CROSS_MANUFACTURERS.find(m => q.includes(m));
  if (OEM_MANUFACTURERS.some(m => q.includes(m))) return OEM_MANUFACTURERS.find(m => q.includes(m));
  return 'GENERIC';
}

function extractPartNumber(query) {
  const patterns = [
    /\b[A-Z]{1,3}[-\s]?\d{4,}\b/i,
    /\b\d{3,}[-]?\d{3,}[-]?\d{3,}\b/,
    /\b[A-Z]{2}\d{4,}\b/i,
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return match[0].replace(/\s/g, '');
  }
  
  const fallback = query.match(/[A-Z0-9]{5,}/i);
  return fallback ? fallback[0] : query;
}

function generateSkuFromPartNumber(family, partNumber) {
  const rule = FAMILY_RULES[family];
  if (!rule) return 'EXX0000';
  
  const digits = partNumber.replace(/\D/g, '');
  const lastFour = digits.slice(-4).padStart(4, '0');
  return rule.prefix + lastFour;
}

function setSheetsInstance(instance) {
  _sheetsInstance = instance;
}

/**
 * Función principal CON logging extensivo
 */
async function detectFilter(queryRaw, sheetsInstance = null) {
  console.log(`\n🔵 ====== INICIO DETECCIÓN DEBUG ======`);
  console.log(`📝 Query recibida: "${queryRaw}"`);
  
  try {
    console.log('🔍 [1/10] Normalizando query...');
    const query = normalizeQuery(queryRaw);
    console.log(`✅ Query normalizada: "${query}"`);
    
    console.log('🔍 [2/10] Detectando family...');
    const family = detectFamily(query);
    console.log(`✅ Family detectada: ${family}`);
    
    console.log('🔍 [3/10] Detectando duty...');
    const duty = detectDuty(query, family);
    console.log(`✅ Duty detectado: ${duty}`);
    
    console.log('🔍 [4/10] Detectando source...');
    const source = detectSource(query);
    console.log(`✅ Source detectado: ${source}`);
    
    console.log('🔍 [5/10] Extrayendo part number...');
    const partNumber = extractPartNumber(query);
    console.log(`✅ Part number: ${partNumber}`);
    
    console.log('📊 Detección inicial completa:', { family, duty, source, partNumber });
    
    const directCross = isAlreadyCrossReference(query);
    
    let sku;
    let homologatedCode;
    let scraperData = null;
    
    // CASO 1: Ya es cross-reference directo
    if (directCross) {
      console.log(`✅ [6/10] Es cross-reference directo: ${directCross.brand} ${directCross.partNumber}`);
      homologatedCode = directCross.partNumber;
      sku = generateSkuFromPartNumber(family, homologatedCode);
      console.log(`✅ SKU generado: ${sku}`);
      
      // Intentar scraping (con timeout)
      console.log('🌐 [7/10] Intentando scraping de página completa...');
      try {
        if (directCross.brand === 'DONALDSON' && getDonaldsonData) {
          console.log('🔍 Llamando getDonaldsonData...');
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Scraping timeout')), 30000)
          );
          scraperData = await Promise.race([getDonaldsonData(homologatedCode), timeoutPromise]);
          console.log('✅ Scraping Donaldson completado');
        } else if (directCross.brand === 'FRAM' && getFRAMData) {
          console.log('🔍 Llamando getFRAMData...');
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Scraping timeout')), 30000)
          );
          scraperData = await Promise.race([getFRAMData(homologatedCode), timeoutPromise]);
          console.log('✅ Scraping FRAM completado');
        } else {
          console.log('⚠️ Scraper no disponible o no aplicable');
        }
      } catch (scrapingError) {
        console.error('❌ Error en scraping:', scrapingError.message);
        console.log('⚠️ Continuando sin datos de scraping');
      }
    } 
    // CASO 2: Es OEM - buscar homologación
    else {
      console.log(`🔄 [6/10] Es OEM, buscando homologación...`);
      
      // NIVEL 1: Buscar en DB local
      console.log('🔍 Buscando en DB local...');
      let equivalence = findEquivalence(partNumber, duty);
      
      if (equivalence) {
        console.log(`✅ Equivalencia en DB local: ${equivalence.brand} ${equivalence.partNumber}`);
        homologatedCode = equivalence.partNumber;
      } else {
        console.log('⚠️ No encontrado en DB local');
        
        // NIVEL 2: Buscar en Google Sheets
        console.log('🔍 Buscando en Google Sheets...');
        const sheets = sheetsInstance || _sheetsInstance;
        if (sheets) {
          try {
            const sheetsCross = await sheets.findCrossReference(partNumber);
            if (sheetsCross) {
              const targetPart = duty === 'HD' ? sheetsCross.donaldson : sheetsCross.fram;
              if (targetPart) {
                console.log(`✅ Equivalencia en Sheets: ${duty === 'HD' ? 'DONALDSON' : 'FRAM'} ${targetPart}`);
                homologatedCode = targetPart;
              }
            }
          } catch (sheetsError) {
            console.error('❌ Error buscando en Sheets:', sheetsError.message);
          }
        } else {
          console.log('⚠️ Sheets no disponible');
        }
      }
      
      // NIVEL 3: Web Scraping
      console.log('🔍 [7/10] Verificando si necesita scraping...');
      if (!homologatedCode) {
        console.log('🌐 Buscando homologación con scraping...');
        
        try {
          if (duty === 'HD' && getDonaldsonData) {
            console.log('🔍 Intentando scraping Donaldson...');
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Scraping timeout')), 30000)
            );
            const donaldsonData = await Promise.race([getDonaldsonData(partNumber), timeoutPromise]);
            
            if (donaldsonData && donaldsonData.found) {
              homologatedCode = donaldsonData.donaldson_code;
              scraperData = donaldsonData;
              console.log(`✅ Encontrado en Donaldson: ${homologatedCode}`);
            }
          } else if (duty === 'LD' && getFRAMData) {
            console.log('🔍 Intentando scraping FRAM...');
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Scraping timeout')), 30000)
            );
            const framData = await Promise.race([getFRAMData(partNumber), timeoutPromise]);
            
            if (framData && framData.found) {
              homologatedCode = framData.fram_code;
              scraperData = framData;
              console.log(`✅ Encontrado en FRAM: ${homologatedCode}`);
            }
          }
        } catch (scrapingError) {
          console.error('❌ Error en scraping:', scrapingError.message);
          console.log('⚠️ Continuando sin scraping');
        }
      } else {
        console.log('✅ Ya tiene homologación, no necesita scraping');
      }
      
      // Generar SKU
      console.log('🔍 [8/10] Generando SKU...');
      if (homologatedCode) {
        sku = generateSkuFromPartNumber(family, homologatedCode);
        console.log(`✅ SKU homologado: ${sku} (usando ${homologatedCode})`);
      } else {
        homologatedCode = partNumber;
        sku = generateSkuFromPartNumber(family, partNumber);
        console.log(`⚠️ Sin homologación, usando OEM: ${sku}`);
      }
    }
    
    // Compilar datos completos
    console.log('🔍 [9/10] Compilando resultado final...');
    const result = {
      status: 'OK',
      from_cache: false,
      
      // Básicos
      query_norm: query,
      sku: sku,
      filter_type: family,
      duty: duty,
      oem_code: partNumber,
      source_code: homologatedCode,
      source: scraperData ? (duty === 'HD' ? 'donaldson' : 'fram') : 'oem',
      
      // Arrays (máximo 10 cada uno)
      cross_reference: scraperData ? cleanArray(scraperData.cross_references, 10) : [],
      oem_codes: scraperData ? cleanArray(scraperData.oem_codes, 10) : [],
      engine_applications: scraperData ? cleanArray(scraperData.engine_applications.map(formatEngineApplication), 10) : [],
      equipment_applications: scraperData ? cleanArray(scraperData.equipment_applications.map(formatEquipmentApplication), 10) : [],
      
      // Specs
      specs: scraperData ? (combineWithDefaults(scraperData, family, duty).specs || {}) : {},
      
      // Descripción
      description: scraperData && scraperData.description ? scraperData.description : generateDefaultDescription(sku, family, duty),
      
      // Metadata
      created_at: new Date().toISOString()
    };
    
    console.log(`✅ [10/10] Resultado compilado exitosamente`);
    console.log(`🔵 ====== FIN DETECCIÓN: ${sku} ======\n`);
    
    return result;
    
  } catch (error) {
    console.error(`❌ ====== ERROR CRÍTICO EN DETECCIÓN ======`);
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    
    // Retornar resultado básico en caso de error
    return {
      status: 'ERROR',
      message: error.message,
      query_norm: queryRaw.toUpperCase(),
      sku: 'EXX0000',
      filter_type: 'UNKNOWN',
      duty: 'UNKNOWN',
      oem_code: queryRaw,
      cross_reference: [],
      oem_codes: [],
      engine_applications: [],
      equipment_applications: [],
      specs: {},
      description: 'Error processing filter',
      created_at: new Date().toISOString()
    };
  }
}

console.log('✅ [DEBUG] detectionService.js cargado completamente');

module.exports = { detectFilter, setSheetsInstance };
