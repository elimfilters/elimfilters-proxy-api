// detectionService.js v4.1.0 — SIN SCRAPERS (version estable)
let _sheetsInstance = null;

console.log('🟢 [DEBUG] Iniciando detectionService SIN scrapers...');

const normalizeQuery = require('./utils/normalizeQuery');
console.log('✅ [DEBUG] normalizeQuery cargado');

const { findEquivalence } = require('./crossReferenceDB');
console.log('✅ [DEBUG] crossReferenceDB cargado');

// SCRAPERS DESHABILITADOS - Usar solo DB local y Sheets
console.log('⚠️ [DEBUG] Scrapers deshabilitados - usando solo DB local');

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
  if (/^P\d{6}/.test(q)) return { brand: 'DONALDSON', duty: 'HD', partNumber: q };
  if (/^(PH|CA|CS|FS|CH|BG|G)\d{4,}/.test(q)) return { brand: 'FRAM', duty: 'LD', partNumber: q };
  if (/^CF\d{5}/.test(q)) return { brand: 'FRAM', duty: 'LD', partNumber: q };
  if (/^(LF|FF|AF|HF)\d{4,}/.test(q)) return { brand: 'FLEETGUARD', duty: 'HD', partNumber: q };
  if (/^(B|BT|PA)\d{3,}/.test(q)) return { brand: 'BALDWIN', duty: 'HD', partNumber: q };
  if (/^(CUK|CU)\d{4}/.test(q)) return { brand: 'MANN', duty: 'LD', partNumber: q };
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
    const query = normalizeQuery(queryRaw);
    const family = detectFamily(query);
    const duty = detectDuty(query, family);
    const source = detectSource(query);
    const partNumber = extractPartNumber(query);
    
    console.log(`📊 Detección: family=${family}, duty=${duty}, part=${partNumber}`);
    
    const directCross = isAlreadyCrossReference(query);
    let sku, homologatedCode;
    
    if (directCross) {
      console.log(`✅ Cross directo: ${directCross.brand} ${directCross.partNumber}`);
      homologatedCode = directCross.partNumber;
      sku = generateSkuFromPartNumber(family, homologatedCode);
    } else {
      console.log(`🔄 OEM - buscando homologación...`);
      
      // NIVEL 1: DB local
      let equivalence = findEquivalence(partNumber, duty);
      
      if (equivalence) {
        console.log(`✅ DB: ${equivalence.brand} ${equivalence.partNumber}`);
        homologatedCode = equivalence.partNumber;
      } else {
        // NIVEL 2: Google Sheets
        const sheets = sheetsInstance || _sheetsInstance;
        if (sheets) {
          try {
            const sheetsCross = await sheets.findCrossReference(partNumber);
            if (sheetsCross) {
              const targetPart = duty === 'HD' ? sheetsCross.donaldson : sheetsCross.fram;
              if (targetPart) {
                console.log(`✅ Sheets: ${targetPart}`);
                homologatedCode = targetPart;
              }
            }
          } catch (err) {
            console.error('❌ Sheets error:', err.message);
          }
        }
      }
      
      // Generar SKU
      if (homologatedCode) {
        sku = generateSkuFromPartNumber(family, homologatedCode);
        console.log(`✅ SKU homologado: ${sku}`);
      } else {
        homologatedCode = partNumber;
        sku = generateSkuFromPartNumber(family, partNumber);
        console.log(`⚠️ SKU OEM: ${sku}`);
      }
    }
    
    const result = {
      status: 'OK',
      from_cache: false,
      query_norm: query,
      sku: sku,
      filter_type: family,
      duty: duty,
      oem_code: partNumber,
      source_code: homologatedCode,
      source: 'database',
      cross_reference: [],
      oem_codes: [],
      engine_applications: [],
      equipment_applications: [],
      specs: {},
      description: `Filtro ${family} para ${duty === 'HD' ? 'Heavy Duty' : 'Light Duty'} - SKU: ${sku}`,
      created_at: new Date().toISOString(),
      note: 'Scrapers deshabilitados - usando solo DB local y Sheets'
    };
    
    console.log(`✅ Completado: ${sku}`);
    console.log(`🔵 ====== FIN DETECCIÓN ======\n`);
    
    return result;
    
  } catch (error) {
    console.error(`❌ ERROR:`, error.message);
    
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

console.log('✅ [DEBUG] detectionService.js READY (sin scrapers)');

module.exports = { detectFilter, setSheetsInstance };
