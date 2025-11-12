// detectionService.js v2.0.1 — FUNCIONAL CON SCRAPERS Y SHEETS
let _sheetsInstance = null;

console.log('🟢 [DEBUG] Iniciando carga de módulos v2.0...');

const normalizeQuery = require('./utils/normalizeQuery');
console.log('✅ [DEBUG] normalizeQuery cargado');

const { findEquivalence } = require('./crossReferenceDB');
console.log('✅ [DEBUG] crossReferenceDB cargado');

let getDonaldsonData, getFRAMData, cleanArray, formatEngineApplication, formatEquipmentApplication, combineWithDefaults, generateDefaultDescription;

try {
  const donaldsonModule = require('./donaldsonScraper');
  getDonaldsonData = donaldsonModule.getDonaldsonData;
} catch (error) {
  console.error('❌ Error cargando donaldsonScraper:', error.message);
  getDonaldsonData = async () => ({ found: false });
}

try {
  const framModule = require('./framScraper');
  getFRAMData = framModule.getFRAMData;
} catch (error) {
  console.error('❌ Error cargando framScraper:', error.message);
  getFRAMData = async () => ({ found: false });
}

try {
  const utilsModule = require('./scrapersUtils');
  cleanArray = utilsModule.cleanArray;
  formatEngineApplication = utilsModule.formatEngineApplication;
  formatEquipmentApplication = utilsModule.formatEquipmentApplication;
  combineWithDefaults = utilsModule.combineWithDefaults;
  generateDefaultDescription = utilsModule.generateDefaultDescription;
} catch (error) {
  console.error('❌ Error cargando scrapersUtils:', error.message);
  cleanArray = arr => arr;
  formatEngineApplication = t => t;
  formatEquipmentApplication = t => t;
  combineWithDefaults = d => d;
  generateDefaultDescription = () => '';
}

console.log('✅ Módulos cargados');

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
  KIT_GASOLINE: { patterns: ['GASOLINE KIT', 'KIT GASOLINA'], prefix: 'EK3' }
};

function detectFamily(query) {
  const upper = query.toUpperCase();
  for (const [family, rule] of Object.entries(FAMILY_RULES)) {
    if (rule.patterns.some(p => upper.includes(p))) return family;
  }
  return 'GENERIC';
}

function detectDuty(brand) {
  if (brand === 'FRAM') return 'LD';
  return 'HD';
}

function detectPrefix(family) {
  return FAMILY_RULES[family]?.prefix || 'EX0';
}

async function detectFilter(query, sheetsInstance) {
  _sheetsInstance = sheetsInstance || _sheetsInstance;
  if (!_sheetsInstance) throw new Error('Sheets instance not initialized');

  const normalized = normalizeQuery(query);
  const family = detectFamily(normalized);
  const duty = detectDuty(normalized.includes('PH') ? 'FRAM' : 'DONALDSON');
  const prefix = detectPrefix(family);

  let brand = 'UNKNOWN';
  let partData = null;
  let partNumber = '';

  if (/^(PH|CA|CS|FS|CH|BG|G|CF)\d{3,}/.test(normalized)) {
    brand = 'FRAM';
    partNumber = normalized;
    partData = await getFRAMData(normalized);
  } else if (/^(P|B|DB|DBC|X|L|E)\d{4,}/.test(normalized)) {
    brand = 'DONALDSON';
    partNumber = normalized;
    partData = await getDonaldsonData(normalized);
  } else {
    const dbResult = await _sheetsInstance.findCrossReference(normalized);
    if (dbResult?.donaldson) {
      brand = 'DONALDSON';
      partNumber = dbResult.donaldson;
      partData = await getDonaldsonData(partNumber);
    } else if (dbResult?.fram) {
      brand = 'FRAM';
      partNumber = dbResult.fram;
      partData = await getFRAMData(partNumber);
    } else {
      return { status: 'NOT_FOUND', message: 'Código no reconocido' };
    }
  }

  if (!partData || !partData.found) {
    return { status: 'SCRAPER_FAIL', message: `No se pudo obtener información para ${partNumber}` };
  }

  const sku = `${prefix}${partNumber}`;
  const description = partData.description || generateDefaultDescription(sku, family, duty);

  const result = {
    sku,
    filter_type: family,
    duty,
    oem_code: query,
    source_code: partNumber,
    source: brand,
    cross_reference: cleanArray(partData.cross_references || []),
    oem_codes: cleanArray(partData.oem_codes || []),
    engine_applications: (partData.engine_applications || []).map(formatEngineApplication),
    equipment_applications: (partData.equipment_applications || []).map(formatEquipmentApplication),
    ...combineWithDefaults(partData, family, duty),
    description
  };

  await _sheetsInstance.replaceOrInsertRow(result);
  return result;
}

function setSheetsInstance(instance) {
  _sheetsInstance = instance;
}

module.exports = { detectFilter, setSheetsInstance };
