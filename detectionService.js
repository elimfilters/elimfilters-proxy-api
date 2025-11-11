// detectionService.js v4.0.0 — CON WEB SCRAPING COMPLETO
let _sheetsInstance = null;
const normalizeQuery = require('./utils/normalizeQuery');
const { findEquivalence } = require('./crossReferenceDB');
const { getDonaldsonData } = require('./scrapers/donaldsonScraper');
const { getFRAMData } = require('./scrapers/framScraper');
const { cleanArray, formatEngineApplication, formatEquipmentApplication, combineWithDefaults, generateDefaultDescription } = require('./scrapers/utils');

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
 * Función principal con scraping completo
 */
async function detectFilter(queryRaw, sheetsInstance = null) {
  console.log(`\n🔍 ====== INICIO DETECCIÓN: ${queryRaw} ======`);
  
  const query = normalizeQuery(queryRaw);
  const family = detectFamily(query);
  const duty = detectDuty(query, family);
  const source = detectSource(query);
  const partNumber = extractPartNumber(query);
  
  console.log(`📊 Detección inicial:`, { family, duty, source, partNumber });
  
  const directCross = isAlreadyCrossReference(query);
  
  let sku;
  let homologatedCode;
  let scraperData = null;
  
  // CASO 1: Ya es cross-reference directo (Donaldson, FRAM, etc.)
  if (directCross) {
    console.log(`✅ Es cross-reference directo: ${directCross.brand} ${directCross.partNumber}`);
    homologatedCode = directCross.partNumber;
    sku = generateSkuFromPartNumber(family, homologatedCode);
    
    // Scrape datos completos
    if (directCross.brand === 'DONALDSON') {
      scraperData = await getDonaldsonData(homologatedCode);
    } else if (directCross.brand === 'FRAM') {
      scraperData = await getFRAMData(homologatedCode);
    }
  } 
  // CASO 2: Es OEM - buscar homologación
  else {
    console.log(`🔄 Es OEM, buscando homologación...`);
    
    // NIVEL 1: Buscar en DB local
    let equivalence = findEquivalence(partNumber, duty);
    
    if (equivalence) {
      console.log(`📗 Equivalencia en DB local: ${equivalence.brand} ${equivalence.partNumber}`);
      homologatedCode = equivalence.partNumber;
    } else {
      // NIVEL 2: Buscar en Google Sheets
      const sheets = sheetsInstance || _sheetsInstance;
      if (sheets) {
        const sheetsCross = await sheets.findCrossReference(partNumber);
        if (sheetsCross) {
          const targetPart = duty === 'HD' ? sheetsCross.donaldson : sheetsCross.fram;
          if (targetPart) {
            console.log(`📘 Equivalencia en Sheets: ${duty === 'HD' ? 'DONALDSON' : 'FRAM'} ${targetPart}`);
            homologatedCode = targetPart;
          }
        }
      }
    }
    
    // NIVEL 3: Web Scraping en tiempo real
    if (!homologatedCode) {
      console.log(`🌐 Buscando homologación con scraping...`);
      
      if (duty === 'HD') {
        // Buscar en Donaldson
        const donaldsonData = await getDonaldsonData(partNumber);
        if (donaldsonData.found) {
          homologatedCode = donaldsonData.donaldson_code;
          scraperData = donaldsonData;
          console.log(`✅ Encontrado en Donaldson: ${homologatedCode}`);
        }
      } else if (duty === 'LD') {
        // Buscar en FRAM
        const framData = await getFRAMData(partNumber);
        if (framData.found) {
          homologatedCode = framData.fram_code;
          scraperData = framData;
          console.log(`✅ Encontrado en FRAM: ${homologatedCode}`);
        }
      }
    }
    
    // Si encontró homologación, usar ese código
    if (homologatedCode) {
      sku = generateSkuFromPartNumber(family, homologatedCode);
      console.log(`✅ SKU homologado: ${sku} (usando ${homologatedCode})`);
    } else {
      // No encontró homologación - usar OEM directo
      homologatedCode = partNumber;
      sku = generateSkuFromPartNumber(family, partNumber);
      console.log(`⚠️ Sin homologación, usando OEM: ${sku}`);
    }
  }
  
  // Compilar datos completos
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
    specs: scraperData ? combineWithDefaults(scraperData, family, duty).specs : {},
    
    // Descripción
    description: scraperData && scraperData.description ? scraperData.description : generateDefaultDescription(sku, family, duty),
    
    // Metadata
    created_at: new Date().toISOString()
  };
  
  console.log(`✅ ====== FIN DETECCIÓN: ${sku} ======\n`);
  
  return result;
}

module.exports = { detectFilter, setSheetsInstance };
