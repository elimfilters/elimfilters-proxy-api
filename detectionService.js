// detectionService.js v3.3.5 — Estable
const normalizeQuery = require('./utils/normalizeQuery');

const OEM_MANUFACTURERS = [
  'CATERPILLAR', 'KOMATSU', 'CUMMINS', 'VOLVO', 'MACK', 'JOHN DEERE',
  'DETROIT DIESEL', 'PERKINS', 'CASE', 'NEW HOLLAND', 'SCANIA',
  'MERCEDES TRUCK', 'KENWORTH', 'PETERBILT', 'FREIGHTLINER',
  'INTERNATIONAL', 'MTU', 'PACCAR', 'HINO', 'IVECO',
];

const CROSS_MANUFACTURERS = [
  'DONALDSON', 'BALDWIN', 'FRAM', 'FLEETGUARD', 'WIX', 'PUROLATOR',
  'MAN', 'PARKER', 'HENGST', 'KNECHT', 'CHAMPION',
];

const FAMILY_RULES = {
  AIR: { patterns: ['CA', 'CF', 'RS', 'EAF', 'P1'], prefix: 'EA1' },
  OIL: { patterns: ['OIL', '1R', 'PH', 'LF', 'B', 'BT'], prefix: 'EL8' },
  FUEL: { patterns: ['FF', 'FS', 'P77', 'P52'], prefix: 'EF9' },
  CABIN: { patterns: ['CABIN', 'AC', 'A/C'], prefix: 'EC1' },
  HYDRAULIC: { patterns: ['HF', 'H'], prefix: 'EH6' },
  COOLANT: { patterns: ['COOLANT', 'REFRIGERANTE'], prefix: 'EW7' },
  AIR_DRYER: { patterns: ['DRYER', 'SECANTE'], prefix: 'ED4' },
  TURBINE: { patterns: ['TURBINA', 'PARKER'], prefix: 'ET9' },
  HOUSING: { patterns: ['HOUSING', 'CARCASA'], prefix: 'EA2' },
  KIT_DIESEL: { patterns: ['DIESEL KIT', 'KIT DIESEL'], prefix: 'EK5' },
  KIT_GASOLINE: { patterns: ['GASOLINE KIT', 'KIT GASOLINA'], prefix: 'EK3' },
};

function detectFamily(query) {
  const q = query.toUpperCase();
  for (const [family, { patterns }] of Object.entries(FAMILY_RULES)) {
    if (patterns.some(p => q.includes(p))) return family;
  }
  return 'UNKNOWN';
}

function detectDuty(query, family) {
  const q = query.toUpperCase();
  if (OEM_MANUFACTURERS.some(m => q.includes(m))) return 'HD';
  if (['TOYOTA', 'FORD', 'NISSAN', 'MAZDA', 'LEXUS', 'BMW', 'MERCEDES'].some(m => q.includes(m))) return 'LD';
  if (['KIT_DIESEL', 'HYDRAULIC', 'TURBINE', 'AIR_DRYER'].includes(family)) return 'HD';
  return 'UNKNOWN';
}

function detectSource(query) {
  const q = query.toUpperCase();
  if (CROSS_MANUFACTURERS.some(m => q.includes(m))) return CROSS_MANUFACTURERS.find(m => q.includes(m));
  if (OEM_MANUFACTURERS.some(m => q.includes(m))) return OEM_MANUFACTURERS.find(m => q.includes(m));
  return 'GENERIC';
}

function generateSku(family, query) {
  const rule = FAMILY_RULES[family];
  if (!rule) return 'EXX0000';
  const digits = query.replace(/\D/g, '');
  const lastFour = digits.slice(-4);
  return rule.prefix + lastFour;
}

async function detectFilter(queryRaw) {
  const query = normalizeQuery(queryRaw);
  const family = detectFamily(query);
  const duty = detectDuty(query, family);
  const source = detectSource(query);
  const sku = generateSku(family, query);

  return {
    query_norm: query,
    sku,
    family,
    duty,
    source,
    homologated_sku: sku,
    filter_type: family !== 'UNKNOWN' ? `${family} FILTER` : '',
    description: `Filtro homologado tipo ${family} para aplicación ${duty === 'HD' ? 'Heavy Duty' : 'Light Duty'}`,
  };
}

module.exports = { detectFilter };
