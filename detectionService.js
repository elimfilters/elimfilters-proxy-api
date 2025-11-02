// =========================================
// ELIMFILTERS Detection Service v3.2.1
// =========================================

let sheetsInstance = null;
function setSheetsInstance(instance) {
  sheetsInstance = instance;
  console.log('✅ Sheets instance configurada en detectionService');
}

// =========================================
// CLASIFICACIÓN DE FAMILY Y DUTY
// =========================================
function detectFilterFamily(code) {
  const upper = code.toUpperCase();

  const families = [
    { name: 'AIR', patterns: ['AIR', 'AIRE', 'CA', 'CF', 'RS', 'P1', 'EAF'] },
    { name: 'FUEL', patterns: ['FUEL', 'COMBUSTIBLE'] },
    { name: 'OIL', patterns: ['OIL', 'ACEITE', 'LUBE'] },
    { name: 'CABIN', patterns: ['CABIN', 'CABINA', 'AC'] },
    { name: 'SEPARATOR', patterns: ['SEPARATOR', 'SEPARADOR'] },
    { name: 'HYDRAULIC', patterns: ['HYDRAULIC', 'HIDRAULICO'] },
    { name: 'COOLANT', patterns: ['COOLANT', 'REFRIGERANTE'] },
    { name: 'DRYER', patterns: ['DRYER', 'SECANTE'] },
    { name: 'TURBINE', patterns: ['TURBINE', 'PARKER TURBINE SERIES'] },
    { name: 'HOUSING', patterns: ['CARCAZA'] },
    { name: 'KIT_DIESEL', patterns: ['KIT DIESEL', 'ENGINE DIESEL'] },
    { name: 'KIT_GASOLINE', patterns: ['KIT GASOLINE', 'ENGINE GASOLINE'] }
  ];

  for (const fam of families) {
    for (const p of fam.patterns) {
      if (upper.includes(p)) return fam.name;
    }
  }
  return 'UNKNOWN';
}

function classifyDutyLevel(code) {
  const upper = code.toUpperCase();

  const hd = ['CAT', 'CATERPILLAR', 'KOMATSU', 'MACK', 'VOLVO', 'JOHN DEERE', 'CUMMINS', 'DETROIT', 'IVECO'];
  const ld = ['FORD', 'TOYOTA', 'HONDA', 'NISSAN', 'MAZDA', 'LEXUS', 'BMW', 'MERCEDES', 'AUDI'];

  if (hd.some(m => upper.includes(m))) return 'HD';
  if (ld.some(m => upper.includes(m))) return 'LD';
  return 'HD'; // default por robustez
}

// =========================================
// CONSTRUCCIÓN DE SKU FINAL
// =========================================
function buildFinalSKU(query, family, duty, baseSource) {
  const code = query.toUpperCase().trim();
  const digits = code.replace(/\D/g, '').slice(-4) || '0000';

  const prefixMap = {
    AIR: 'EA1',
    FUEL: 'EF9',
    OIL: 'EL8',
    CABIN: 'EC1',
    SEPARATOR: 'ES9',
    HYDRAULIC: 'EH6',
    COOLANT: 'EW7',
    DRYER: 'ED4',
    TURBINE: 'ET9',
    HOUSING: 'EA2',
    KIT_DIESEL: 'EK5',
    KIT_GASOLINE: 'EK3'
  };
  const prefix = prefixMap[family] || 'EXX';

  let finalSKU;

  if (baseSource === 'DONALDSON' || code.startsWith('P')) {
    finalSKU = `${prefix}${digits}`; // usa mismos 4 números Donaldson
  } else if (baseSource === 'FRAM' || code.startsWith('PH')) {
    finalSKU = `${prefix}${digits}`; // usa 4 números Fram
  } else {
    finalSKU = `${prefix}${digits}`; // usa los 4 del OEM comercial
  }

  if (!/^\d{4}$/.test(digits)) finalSKU = `${prefix}0000`;

  return {
    query,
    family,
    duty,
    source: baseSource || 'GENERIC',
    homologated_sku: prefix,
    final_sku: finalSKU
  };
}

// =========================================
// DETECTOR PRINCIPAL
// =========================================
async function detectFilter(query) {
  try {
    const family = detectFilterFamily(query);
    const duty = classifyDutyLevel(query);

    let baseSource = 'GENERIC';
    if (query.startsWith('P')) baseSource = 'DONALDSON';
    else if (query.startsWith('PH')) baseSource = 'FRAM';

    const result = buildFinalSKU(query, family, duty, baseSource);

    return {
      status: 'OK',
      query,
      family,
      duty,
      source: baseSource,
      homologated_sku: result.homologated_sku,
      final_sku: result.final_sku
    };
  } catch (error) {
    return { status: 'ERROR', message: error.message };
  }
}

// =========================================
// EXPORTS
// =========================================
module.exports = {
  detectFilter,
  classifyDutyLevel,
  detectFilterFamily,
  buildFinalSKU,
  setSheetsInstance
};
