// detectionService.js v3.7.0 — FINAL sin web search
let _sheetsInstance = null;
const normalizeQuery = require('./utils/normalizeQuery');
const { findEquivalence } = require('./crossReferenceDB');

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

/**
 * Función principal con búsqueda en 2 niveles
 */
function setSheetsInstance(instance) {
  _sheetsInstance = instance;
}

async function detectFilter(queryRaw, sheetsInstance = null) {
  const query = normalizeQuery(queryRaw);
  const family = detectFamily(query);
  const duty = detectDuty(query, family);
  const source = detectSource(query);
  const partNumber = extractPartNumber(query);
  
  const directCross = isAlreadyCrossReference(query);
  
  let sku;
  let usedPartNumber;
  let crossBrand = 'N/A';
  let crossPartNumber = 'N/A';
  let oemNumber = partNumber;
  
  if (directCross) {
    // Ya es cross-reference directo
    sku = generateSkuFromPartNumber(family, directCross.partNumber);
    usedPartNumber = directCross.partNumber;
    crossBrand = directCross.brand;
    crossPartNumber = directCross.partNumber;
    oemNumber = 'N/A';
    console.log(`✅ Cross-reference directo: ${directCross.brand} ${directCross.partNumber} → SKU: ${sku}`);
  } else {
    // Es OEM - buscar equivalencia
    
    // NIVEL 1: Buscar en DB local (crossReferenceDB.js)
    let equivalence = findEquivalence(partNumber, duty);
    
    // NIVEL 2: Si no encuentra, buscar en Google Sheets
    const sheets = sheetsInstance || _sheetsInstance;
    if (!equivalence && sheets) {
      const sheetsCross = await sheets.findCrossReference(partNumber);
      if (sheetsCross) {
        const targetPart = duty === 'HD' ? sheetsCross.donaldson : sheetsCross.fram;
        if (targetPart) {
          equivalence = {
            brand: duty === 'HD' ? 'DONALDSON' : 'FRAM',
            partNumber: targetPart,
            family: sheetsCross.family || family
          };
          console.log(`📗 Equivalencia encontrada en Google Sheets: ${equivalence.brand} ${equivalence.partNumber}`);
        }
      }
    }
    
    if (equivalence) {
      sku = generateSkuFromPartNumber(family, equivalence.partNumber);
      usedPartNumber = equivalence.partNumber;
      crossBrand = equivalence.brand;
      crossPartNumber = equivalence.partNumber;
      oemNumber = partNumber;
      console.log(`✅ Equivalencia confirmada: OEM ${partNumber} → ${equivalence.brand} ${equivalence.partNumber} → SKU: ${sku}`);
    } else {
      // No encontró equivalencia - usar OEM
      sku = generateSkuFromPartNumber(family, partNumber);
      usedPartNumber = partNumber;
      oemNumber = partNumber;
      console.log(`⚠️ Sin cross-reference, usando OEM: ${partNumber} → SKU: ${sku}`);
    }
  }
  
  return {
    query_norm: query,
    sku,
    family,
    duty,
    source,
    oem_number: oemNumber,
    cross_brand: crossBrand,
    cross_part_number: crossPartNumber,
    homologated_sku: sku,
    filter_type: family !== 'UNKNOWN' ? `${family} FILTER` : '',
    description: `Filtro homologado tipo ${family} para aplicación ${duty === 'HD' ? 'Heavy Duty' : 'Light Duty'}`,
  };
}

module.exports = { detectFilter, setSheetsInstance };
