// detectionService.js v2.0.0 — CON SCRAPERS AXIOS + CHEERIO + GUARDADO EN SHEETS
let _sheetsInstance = null;

console.log('🟢 [DEBUG] Iniciando carga de módulos v2.0...');

const normalizeQuery = require('./utils/normalizeQuery');
console.log('✅ [DEBUG] normalizeQuery cargado');

const { findEquivalence } = require('./crossReferenceDB');
console.log('✅ [DEBUG] crossReferenceDB cargado');

// Scrapers v2.0 - Axios + Cheerio (ligeros)
let getDonaldsonData, getFRAMData, cleanArray, formatEngineApplication, formatEquipmentApplication, combineWithDefaults, generateDefaultDescription;

try {
  console.log('🔍 [DEBUG] Cargando donaldsonScraper v2.0...');
  const donaldsonModule = require('./donaldsonScraper');
  getDonaldsonData = donaldsonModule.getDonaldsonData;
  console.log('✅ [DEBUG] donaldsonScraper v2.0 cargado');
} catch (error) {
  console.error('❌ [DEBUG] Error cargando donaldsonScraper:', error.message);
  getDonaldsonData = async () => ({ found: false, cross_references: [], oem_codes: [], engine_applications: [], equipment_applications: [], specs: {}, description: '' });
}

try {
  console.log('🔍 [DEBUG] Cargando framScraper v2.0...');
  const framModule = require('./framScraper');
  getFRAMData = framModule.getFRAMData;
  console.log('✅ [DEBUG] framScraper v2.0 cargado');
} catch (error) {
  console.error('❌ [DEBUG] Error cargando framScraper:', error.message);
  getFRAMData = async () => ({ found: false, cross_references: [], oem_codes: [], engine_applications: [], equipment_applications: [], specs: {}, description: '' });
}

try {
  console.log('🔍 [DEBUG] Cargando scrapersUtils...');
  const utilsModule = require('./scrapersUtils');
  cleanArray = utilsModule.cleanArray || ((arr, max) => (arr || []).slice(0, max || 10));
  formatEngineApplication = utilsModule.formatEngineApplication || (text => text);
  formatEquipmentApplication = utilsModule.formatEquipmentApplication || (text => text);
  combineWithDefaults = utilsModule.combineWithDefaults || ((data) => data);
  generateDefaultDescription = utilsModule.generateDefaultDescription || ((sku, family, duty) => `Filter ${sku} ${family} ${duty}`);
  console.log('✅ [DEBUG] scrapersUtils cargado');
} catch (error) {
  console.error('❌ [DEBUG] Error cargando scrapersUtils:', error.message);
  cleanArray = (arr, max) => (arr || []).slice(0, max || 10);
  formatEngineApplication = text => text;
  formatEquipmentApplication = text => text;
  combineWithDefaults = (data) => data;
  generateDefaultDescription = (sku, family, duty) => `Filter ${sku} ${family} ${duty}`;
}

console.log('✅ [DEBUG] Todos los módulos v2.0 cargados');

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
  if (/^(P|B|DB|DBC|X|L|E)\d{4,}/.test(q)) return { brand: 'DONALDSON', duty: 'HD', partNumber: q };
  if (/^(PH|CA|CS|FS|CH|BG|G)\d{4,}/.test(q)) return { brand: 'FRAM', duty: 'LD', partNumber: q };
  if (/^CF\d{5}/.test(q)) return { brand: 'FRAM', duty: 'LD', partNumber: q };
  if (/^(LF|FF|AF|HF)\d{4,}/.test(q)) return { brand: 'FLEETGUARD', duty: 'HD', partNumber: q };
  if (/^(B|BT|PA)\d{3,}/.test(q)) return { brand: 'BALDWIN', duty: 'HD', partNumber: q };
  if (/^(CUK|CU)\d{4}/.test(q)) return { brand: 'MANN', duty: 'LD', partNumber: q };
  return null;
}

function setSheetsInstance(instance) {
  _sheetsInstance = instance;
}

async function detectFilter(query, sheetsInstance = _sheetsInstance) {
  const q = normalizeQuery(query);
  const match = isAlreadyCrossReference(q);
  if (match) return { ...match, sku: match.partNumber, oem_code: q, source_code: q, source: 'DETECTED', cross_reference: [], oem_codes: [], engine_applications: [], equipment_applications: [], specs: {}, description: '', found: true };

  const oemBrand = OEM_MANUFACTURERS.find(brand => q.includes(brand.replace(/\s/g, '')));
  if (!oemBrand) return { status: 'NOT_SUPPORTED', message: 'OEM brand not supported' };

  const cross = await findEquivalence(q);
  let crossData = cross || {};

  if (!cross) {
    if (oemBrand && sheetsInstance) {
      const donaldson = await getDonaldsonData(q);
      const fram = await getFRAMData(q);

      crossData = donaldson.found ? donaldson : fram;
    }
  }

  if (!crossData.found) return { status: 'NOT_FOUND', query: q };

  const allData = combineWithDefaults({
    ...crossData,
    cross_references: cleanArray(crossData.cross_references),
    oem_codes: cleanArray(crossData.oem_codes),
    engine_applications: crossData.engine_applications.map(formatEngineApplication),
    equipment_applications: crossData.equipment_applications.map(formatEquipmentApplication),
    description: crossData.description || generateDefaultDescription(q, 'FILTER', crossData.duty)
  }, 'FILTER', crossData.duty);

  if (sheetsInstance) await sheetsInstance.replaceOrInsertRow({
    sku: q,
    filter_type: 'FILTER',
    duty: allData.duty,
    oem_code: q,
    source_code: q,
    source: 'SCRAPED',
    cross_reference: allData.cross_references,
    oem_codes: allData.oem_codes,
    engine_applications: allData.engine_applications,
    equipment_applications: allData.equipment_applications,
    description: allData.description,
  });

  return { ...allData, sku: q, oem_code: q, source_code: q, source: 'SCRAPED' };
}

module.exports = { detectFilter, setSheetsInstance };
