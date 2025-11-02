const fs = require('fs');
const path = require('path');

let sheetsInstance = null;
let familyRules = [];

// =========================
// CONFIGURACIÓN INICIAL
// =========================
function setSheetsInstance(instance) {
  sheetsInstance = instance;
  console.log('✅ Google Sheets instance configured in detectionService');

  // Cargar FAMILY_RULES desde JSON local
  try {
    const rulesPath = path.join(__dirname, 'familyRules.json');
    const raw = fs.readFileSync(rulesPath, 'utf8');
    familyRules = JSON.parse(raw);
    console.log(`✅ Loaded ${familyRules.length} FAMILY_RULES from JSON`);
  } catch (err) {
    console.error('⚠️ Could not load FAMILY_RULES:', err.message);
    familyRules = [];
  }
}

// =========================
// CATÁLOGOS Y PATRONES
// =========================
const HD_MANUFACTURERS = [
  'CATERPILLAR', 'CAT', 'KOMATSU', 'VOLVO', 'MACK', 'ISUZU', 'IVECO',
  'CUMMINS', 'DETROIT', 'PACCAR', 'NAVISTAR', 'FREIGHTLINER', 'INTERNATIONAL',
  'JOHN DEERE', 'CASE', 'NEW HOLLAND', 'HITACHI', 'DOOSAN', 'HYUNDAI HEAVY',
  'LIEBHERR', 'TEREX', 'SCANIA', 'MAN', 'DAF', 'MERCEDES ACTROS', 'DONALDSON'
];

const LD_MANUFACTURERS = [
  'TOYOTA', 'FORD', 'MERCEDES BENZ', 'BMW', 'HONDA', 'NISSAN',
  'CHEVROLET', 'MAZDA', 'HYUNDAI', 'KIA', 'VOLKSWAGEN', 'AUDI',
  'SUBARU', 'MITSUBISHI', 'JEEP', 'DODGE', 'RAM', 'GMC',
  'LEXUS', 'INFINITI', 'ACURA', 'BUICK', 'CADILLAC', 'FRAM', 'WIX'
];

const HD_KEYWORDS = [
  'DIESEL', 'HEAVY DUTY', 'TRUCK', 'CAMION', 'MAQUINARIA PESADA',
  'EXCAVATOR', 'EXCAVADORA', 'BULLDOZER', 'LOADER', 'CARGADOR',
  'GRADER', 'MOTONIVELADORA', 'TRACTOR', 'AGRICULTURAL', 'AGRICOLA',
  'STATIONARY ENGINE', 'MOTOR ESTACIONARIO', 'GENERATOR', 'GENERADOR',
  'COMPRESSOR', 'COMPRESOR', 'MINING', 'MINERIA', 'CONSTRUCTION',
  'CONSTRUCCION', 'FORESTRY', 'FORESTAL', 'MARINE', 'MARINO',
  'OFF-HIGHWAY', 'OFF HIGHWAY', 'INDUSTRIAL'
];

const LD_KEYWORDS = [
  'GASOLINE', 'GASOLINA', 'PETROL', 'AUTOMOBILE', 'AUTOMOVIL',
  'CAR', 'CARRO', 'SUV', 'SEDAN', 'PICKUP LIGERA', 'LIGHT PICKUP',
  'VAN', 'MINIVAN', 'CROSSOVER', 'HATCHBACK', 'COUPE', 'PASSENGER',
  'LIGHT DUTY', 'ON-HIGHWAY', 'ON HIGHWAY'
];

// =========================
// FUNCIONES PRINCIPALES
// =========================
async function searchInGoogleSheets(query) {
  try {
    if (!sheetsInstance) throw new Error('Google Sheets not initialized');
    const queryNorm = query.toUpperCase().trim();

    const result = await sheetsInstance.searchInMaster(queryNorm);
    if (result && result.found) {
      console.log(`✅ Found in Google Sheets: ${result.data.sku}`);
      return { found: true, data: result.data };
    }
    return { found: false };
  } catch (error) {
    console.error('❌ Error searching in Google Sheets:', error);
    return { found: false, error: error.message };
  }
}

function classifyDutyLevel(context) {
  const text = context.toUpperCase();
  let hdScore = 0, ldScore = 0;

  for (const mfg of HD_MANUFACTURERS) if (text.includes(mfg)) hdScore += 3;
  for (const mfg of LD_MANUFACTURERS) if (text.includes(mfg)) ldScore += 3;
  for (const k of HD_KEYWORDS) if (text.includes(k)) hdScore += 2;
  for (const k of LD_KEYWORDS) if (text.includes(k)) ldScore += 2;

  if (hdScore === ldScore) return { duty: 'UNKNOWN', confidence: 0 };
  const duty = hdScore > ldScore ? 'HD' : 'LD';
  const confidence = Math.max(hdScore, ldScore) / (hdScore + ldScore);
  return { duty, confidence };
}

function detectFilterFamily(query, context = '') {
  const combined = (query + ' ' + context).toUpperCase();
  const patterns = {
    'OIL': ['OIL', 'ACEITE', 'LUBRICANT', 'LUBRICATION', 'LF', 'P55'],
    'FUEL': ['FUEL', 'COMBUSTIBLE', 'DIESEL', 'GASOLINE', 'FS', 'FF'],
    'AIR': ['AIR', 'AIRE', 'AF', 'PA', 'INTAKE', 'ADMISION'],
    'HYDRAULIC': ['HYDRAULIC', 'HIDRAULICO', 'HF', 'HH'],
    'COOLANT': ['COOLANT', 'REFRIGERANTE', 'WF', 'WATER'],
    'CABIN': ['CABIN', 'CABINA', 'CF', 'HVAC', 'AC'],
    'SEPARATOR': ['SEPARATOR', 'SEPARADOR', 'COALESCER', 'COALESCENTE']
  };

  let detected = 'UNKNOWN', max = 0;
  for (const family in patterns) {
    const matches = patterns[family].filter(k => combined.includes(k)).length;
    if (matches > max) { max = matches; detected = family; }
  }
  return { family: detected, confidence: Math.min(max / 3, 1) };
}

// =========================
// DETECCIÓN PRINCIPAL
// =========================
async function detectFilter(query) {
  try {
    console.log('🔍 Detecting filter for:', query);

    const sheetsResult = await searchInGoogleSheets(query);
    let family = 'UNKNOWN', duty = 'UNKNOWN', baseSku = query;

    if (sheetsResult.found) {
      const d = sheetsResult.data;
      family = d.family || detectFilterFamily(query).family;
      duty = d.duty || classifyDutyLevel(d.oem_codes + ' ' + d.cross_reference).duty;
      baseSku = d.sku || query;
    } else {
      const fam = detectFilterFamily(query);
      const dut = classifyDutyLevel(query);
      family = fam.family;
      duty = dut.duty;
    }

    // Aplicar reglas JSON
    let prefix = 'ELX';
    const rule = familyRules.find(r =>
      r.family.toUpperCase() === family.toUpperCase() &&
      r.duty.toUpperCase() === duty.toUpperCase()
    );
    if (rule) prefix = rule.prefix;

    const homologatedSku = `${prefix}-${baseSku}`.replace(/\s+/g, '');

    return {
      status: 'OK',
      query,
      homologated_sku: homologatedSku,
      family,
      duty,
      source: sheetsResult.found ? 'database' : 'pattern_detection'
    };
  } catch (error) {
    console.error('❌ Error in detectFilter:', error);
    return { status: 'ERROR', message: error.message };
  }
}

module.exports = {
  detectFilter,
  searchInGoogleSheets,
  classifyDutyLevel,
  detectFilterFamily,
  setSheetsInstance
};
