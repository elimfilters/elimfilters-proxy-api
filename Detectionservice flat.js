// detectionService.js v4.0.2 — SCRAPERS EN RAÍZ (sin subcarpeta)
let _sheetsInstance = null;

console.log('🟢 [DEBUG] Iniciando carga de módulos...');

const normalizeQuery = require('./utils/normalizeQuery');
console.log('✅ [DEBUG] normalizeQuery cargado');

const { findEquivalence } = require('./crossReferenceDB');
console.log('✅ [DEBUG] crossReferenceDB cargado');

// Scrapers - BUSCANDO EN RAÍZ (sin ./scrapers/)
let getDonaldsonData, getFRAMData, cleanArray, formatEngineApplication, formatEquipmentApplication, combineWithDefaults, generateDefaultDescription;

try {
  console.log('🔍 [DEBUG] Intentando cargar donaldsonScraper desde raíz...');
  const donaldsonModule = require('./donaldsonScraper');  // ← SIN scrapers/
  getDonaldsonData = donaldsonModule.getDonaldsonData;
  console.log('✅ [DEBUG] donaldsonScraper cargado desde raíz');
} catch (error) {
  console.error('❌ [DEBUG] Error cargando donaldsonScraper:', error.message);
  getDonaldsonData = async () => ({ found: false, cross_references: [], oem_codes: [], engine_applications: [], equipment_applications: [], specs: {}, description: '' });
}

try {
  console.log('🔍 [DEBUG] Intentando cargar framScraper desde raíz...');
  const framModule = require('./framScraper');  // ← SIN scrapers/
  getFRAMData = framModule.getFRAMData;
  console.log('✅ [DEBUG] framScraper cargado desde raíz');
} catch (error) {
  console.error('❌ [DEBUG] Error cargando framScraper:', error.message);
  getFRAMData = async () => ({ found: false, cross_references: [], oem_codes: [], engine_applications: [], equipment_applications: [], specs: {}, description: '' });
}

try {
  console.log('🔍 [DEBUG] Intentando cargar scrapers-utils desde raíz...');
  const utilsModule = require('./scrapers-utils');  // ← Buscar scrapers-utils.js en raíz
  cleanArray = utilsModule.cleanArray || ((arr, max) => (arr || []).slice(0, max || 10));
  formatEngineApplication = utilsModule.formatEngineApplication || (text => text);
  formatEquipmentApplication = utilsModule.formatEquipmentApplication || (text => text);
  combineWithDefaults = utilsModule.combineWithDefaults || ((data) => data);
  generateDefaultDescription = utilsModule.generateDefaultDescription || ((sku, family, duty) => `Filter ${sku} ${family} ${duty}`);
  console.log('✅ [DEBUG] scrapers-utils cargado desde raíz');
} catch (error) {
  console.error('❌ [DEBUG] Error cargando scrapers-utils:', error.message);
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

async function detectFilter(queryRaw, sheetsInstance = null) {
  console.log(`\n🔵 ====== INICIO DETECCIÓN: ${queryRaw} ======`);
  
  try {
    console.log('🔍 [1/10] Normalizando query...');
    const query = normalizeQuery(queryRaw);
    console.log(`✅ Query normalizada: "${query}"`);
    
    console.log('🔍 [2/10] Detectando family...');
    const family = detectFamily(query);
    console.log(`✅ Family: ${family}`);
    
    console.log('🔍 [3/10] Detectando duty...');
    const duty = detectDuty(query, family);
    console.log(`✅ Duty: ${duty}`);
    
    console.log('🔍 [4/10] Detectando source...');
    const source = detectSource(query);
    console.log(`✅ Source: ${source}`);
    
    console.log('🔍 [5/10] Extrayendo part number...');
    const partNumber = extractPartNumber(query);
    console.log(`✅ Part number: ${partNumber}`);
    
    const directCross = isAlreadyCrossReference(query);
    
    let sku;
    let homologatedCode;
    let scraperData = null;
    
    if (directCross) {
      console.log(`✅ [6/10] Cross-reference directo: ${directCross.brand} ${directCross.partNumber}`);
      homologatedCode = directCross.partNumber;
      sku = generateSkuFromPartNumber(family, homologatedCode);
      
      console.log('🌐 [7/10] Intentando scraping...');
      try {
        if (directCross.brand === 'DONALDSON' && getDonaldsonData) {
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000));
          scraperData = await Promise.race([getDonaldsonData(homologatedCode), timeout]);
          console.log('✅ Scraping Donaldson OK');
        } else if (directCross.brand === 'FRAM' && getFRAMData) {
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000));
          scraperData = await Promise.race([getFRAMData(homologatedCode), timeout]);
          console.log('✅ Scraping FRAM OK');
        }
      } catch (err) {
        console.error('❌ Scraping falló:', err.message);
      }
    } else {
      console.log(`🔄 [6/10] Es OEM, buscando homologación...`);
      
      let equivalence = findEquivalence(partNumber, duty);
      
      if (equivalence) {
        console.log(`✅ Equivalencia en DB: ${equivalence.brand} ${equivalence.partNumber}`);
        homologatedCode = equivalence.partNumber;
      } else {
        const sheets = sheetsInstance || _sheetsInstance;
        if (sheets) {
          try {
            const sheetsCross = await sheets.findCrossReference(partNumber);
            if (sheetsCross) {
              const targetPart = duty === 'HD' ? sheetsCross.donaldson : sheetsCross.fram;
              if (targetPart) {
                console.log(`✅ Equivalencia en Sheets: ${targetPart}`);
                homologatedCode = targetPart;
              }
            }
          } catch (err) {
            console.error('❌ Error Sheets:', err.message);
          }
        }
      }
      
      console.log('🌐 [7/10] Verificando scraping...');
      if (!homologatedCode) {
        try {
          if (duty === 'HD' && getDonaldsonData) {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000));
            const data = await Promise.race([getDonaldsonData(partNumber), timeout]);
            if (data && data.found) {
              homologatedCode = data.donaldson_code;
              scraperData = data;
              console.log(`✅ Scraping Donaldson: ${homologatedCode}`);
            }
          } else if (duty === 'LD' && getFRAMData) {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000));
            const data = await Promise.race([getFRAMData(partNumber), timeout]);
            if (data && data.found) {
              homologatedCode = data.fram_code;
              scraperData = data;
              console.log(`✅ Scraping FRAM: ${homologatedCode}`);
            }
          }
        } catch (err) {
          console.error('❌ Scraping falló:', err.message);
        }
      }
      
      console.log('🔍 [8/10] Generando SKU...');
      if (homologatedCode) {
        sku = generateSkuFromPartNumber(family, homologatedCode);
        console.log(`✅ SKU homologado: ${sku}`);
      } else {
        homologatedCode = partNumber;
        sku = generateSkuFromPartNumber(family, partNumber);
        console.log(`⚠️ SKU OEM: ${sku}`);
      }
    }
    
    console.log('🔍 [9/10] Compilando resultado...');
    const result = {
      status: 'OK',
      from_cache: false,
      query_norm: query,
      sku: sku,
      filter_type: family,
      duty: duty,
      oem_code: partNumber,
      source_code: homologatedCode,
      source: scraperData ? (duty === 'HD' ? 'donaldson' : 'fram') : 'oem',
      cross_reference: scraperData ? cleanArray(scraperData.cross_references, 10) : [],
      oem_codes: scraperData ? cleanArray(scraperData.oem_codes, 10) : [],
      engine_applications: scraperData ? cleanArray(scraperData.engine_applications.map(formatEngineApplication), 10) : [],
      equipment_applications: scraperData ? cleanArray(scraperData.equipment_applications.map(formatEquipmentApplication), 10) : [],
      specs: scraperData ? (combineWithDefaults(scraperData, family, duty).specs || {}) : {},
      description: scraperData && scraperData.description ? scraperData.description : generateDefaultDescription(sku, family, duty),
      created_at: new Date().toISOString()
    };
    
    console.log(`✅ [10/10] Completado: ${sku}`);
    console.log(`🔵 ====== FIN DETECCIÓN ======\n`);
    
    return result;
    
  } catch (error) {
    console.error(`❌ ERROR CRÍTICO:`, error.message);
    console.error('Stack:', error.stack);
    
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

console.log('✅ [DEBUG] detectionService.js cargado OK');

module.exports = { detectFilter, setSheetsInstance };
