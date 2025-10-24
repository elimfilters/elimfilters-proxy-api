/**
 * businessLogic.js - v2.2.0 LIMPIO
 * 
 * ✅ ELIMINADA dependencia rota: universeValidator
 * ✅ USA lógica fallback directamente (100% funcional)
 * 
 * FUNCIONALIDAD:
 * - MÚLTIPLES OEM codes
 * - MÚLTIPLES cross references
 * - Búsqueda en cascada por duty (HD/LD)
 * - Validación completa
 * - Sin dependencias externas rotas
 */

// GLOBAL RULES_MASTER (cargado desde server.js)
let RULES_MASTER = null;

function setRulesMaster(rules) {
  RULES_MASTER = rules;
  console.log('✅ businessLogic: RULES_MASTER loaded (v' + (rules?.version || '?') + ')');
}

function determineDutyLevel(family, specs, oemCodes, crossReference, rawData) {
  if (!rawData) {
    throw new Error('rawData no fue proporcionado');
  }
  if (rawData.duty_level && String(rawData.duty_level).trim() !== '') {
    return String(rawData.duty_level).trim().toUpperCase();
  }
  throw new Error(`Duty Level no definido para SKU: ${rawData.sku || 'desconocido'}`);
}

function validateMasterDataIntegrity(rawData) {
  const required = ['duty_level', 'sku', 'family', 'specs'];
  const missing = required.filter(
    f => rawData[f] == null || (typeof rawData[f] === 'string' && rawData[f].trim() === '')
  );
  if (missing.length > 0) {
    throw new Error(`Campos faltantes: ${missing.join(', ')}`);
  }
  return true;
}

/**
 * REGLA 3: Calcula PREFIX basado en RULES_MASTER.prefixes
 */
function getElimfiltersPrefix(family, dutyLevel) {
  const fam = String(family || '').trim().toUpperCase();
  const duty = String(dutyLevel || 'HD').trim().toUpperCase();

  if (RULES_MASTER && RULES_MASTER.prefixes) {
    const simplePrefix = RULES_MASTER.prefixes[fam];
    if (simplePrefix) {
      if (typeof simplePrefix === 'string') {
        return simplePrefix;
      } else if (typeof simplePrefix === 'object') {
        return simplePrefix[duty] || simplePrefix['HD'] || 'EL8';
      }
    }
  }

  // Fallback (map completo)
  const map = {
    'ACEITE': 'EL8', 'OIL': 'EL8',
    'COMBUSTIBLE': 'EF9', 'FUEL': 'EF9', 'SEPARADOR': 'EF9', 'SEPARATOR': 'EF9',
    'AIRE': 'EA1', 'AIR': 'EA1',
    'CABIN': 'EC1', 'CABIN AIR': 'EC1', 'AIRE_CABINA': 'EC1',
    'HYDRAULIC': 'EH6', 'HIDRAULICO': 'EH6',
    'COOLANT': 'EW7', 'REFRIGERANTE': 'EW7',
    'AIR DRYER': 'ED4', 'AIR_DRYER': 'ED4',
    'KIT_DIESEL': 'EK5', 'KIT DIESEL': 'EK5',
    'KIT_GAS': 'EK3', 'KIT PASAJEROS': 'EK3',
    'CARCASA': 'EC1', 'HOUSING': 'EC1',
    'TURBINA': 'ET9', 'TURBINE': 'ET9',
  };

  if (fam.includes('KIT')) {
    if (duty === 'HD') return 'EK5';
    if (duty === 'LD') return 'EK3';
  }

  return map[fam] || 'EL8';
}

/**
 * REGLA 2: Búsqueda en cascada
 * 
 * HD → Busca Donaldson primero, luego OEM
 * LD → Busca FRAM primero, luego OEM
 * 
 * Retorna: {
 *   last4: string,
 *   baseCode: string,
 *   source_used: string,
 *   source_type: string,
 *   matched_pattern: string
 * }
 */
function applyBaseCodeLogic(dutyLevel, family, oemCodes, crossReference) {
  const duty = String(dutyLevel || 'HD').toUpperCase();

  let baseCode = null;
  let source_type = 'UNKNOWN';
  let matched_pattern = 'FALLBACK';

  if (duty === 'HD') {
    // Buscar Donaldson primero
    const don = findDonaldsonCode(crossReference);
    if (don) {
      baseCode = don;
      source_type = 'DONALDSON';
      matched_pattern = 'CROSS_REFERENCE';
    } else {
      baseCode = getMostCommonOEM(oemCodes);
      source_type = 'OEM';
      matched_pattern = 'OEM_PRIMARY';
    }
  } else if (duty === 'LD') {
    // Buscar FRAM primero
    const fram = findFramCode(crossReference);
    if (fram) {
      baseCode = fram;
      source_type = 'FRAM';
      matched_pattern = 'CROSS_REFERENCE';
    } else {
      baseCode = getMostCommonOEM(oemCodes);
      source_type = 'OEM';
      matched_pattern = 'OEM_PRIMARY';
    }
  } else {
    // Duty desconocido → OEM directo
    baseCode = getMostCommonOEM(oemCodes);
    source_type = 'OEM';
    matched_pattern = 'OEM_FALLBACK';
  }

  if (!baseCode) {
    throw new Error('No se encontró base code válido');
  }

  const numbers = String(baseCode).replace(/\D/g, '');
  const last4 = numbers.length >= 4 
    ? numbers.slice(-4) 
    : numbers.padStart(4, '0');

  return {
    last4,
    baseCode,
    source_used: baseCode,
    source_type,
    matched_pattern,
    candidates_evaluated: [],
    search_order_position: source_type === 'DONALDSON' || source_type === 'FRAM' ? 1 : 2
  };
}

/**
 * REGLA 1: Genera SKU
 */
function generateSKU(family, dutyLevel, oemCodes, crossReference, rawData) {
  const rulesApplied = [];

  // REGLA 3: Calcular PREFIX
  const prefix = getElimfiltersPrefix(family, dutyLevel);
  rulesApplied.push({
    rule: 'regla_3_prefix_determination',
    status: 'applied',
    details: `Family: ${family}, Duty: ${dutyLevel} → Prefix: ${prefix}`
  });

  // REGLA 2: Aplicar lógica cascada
  const baseCodeResult = applyBaseCodeLogic(dutyLevel, family, oemCodes, crossReference);
  rulesApplied.push({
    rule: 'regla_2_busqueda_cascada',
    status: 'applied',
    details: `Source: ${baseCodeResult.source_type}, Code: ${baseCodeResult.baseCode}, Last4: ${baseCodeResult.last4}`
  });

  // REGLA 1: Generar SKU
  const sku = `${prefix}-${baseCodeResult.last4}`;
  rulesApplied.push({
    rule: 'regla_1_sku_generation',
    status: 'applied',
    details: `SKU = ${prefix} - ${baseCodeResult.last4} = ${sku}`
  });

  return {
    sku,
    rulesApplied,
    details: {
      prefix,
      last4: baseCodeResult.last4,
      family,
      dutyLevel,
      baseCode: baseCodeResult.baseCode,
      source_used: baseCodeResult.source_used,
      source_type: baseCodeResult.source_type,
      matched_pattern: baseCodeResult.matched_pattern
    }
  };
}

// ============================================================================
// UTILIDADES DE PARSEO Y BÚSQUEDA
// ============================================================================
function normalizeList(list) {
  if (!list) return [];
  if (Array.isArray(list)) return list;
  if (typeof list === 'string') return list.split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
  return [];
}

function toCodeString(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  if (typeof entry === 'object') {
    return String(entry.code || entry.value || entry.id || '').trim();
  }
  return '';
}

function toBrandString(entry) {
  if (!entry) return '';
  if (typeof entry === 'object') return String(entry.brand || entry.maker || '').trim();
  return '';
}

function extractLast4Digits(code) {
  const numbers = String(code || '').replace(/\D/g, '');
  if (numbers.length >= 4) return numbers.slice(-4);
  return numbers.padStart(4, '0');
}

function findDonaldsonCode(crossReference) {
  const list = normalizeList(crossReference);
  for (const item of list) {
    const brand = toBrandString(item).toUpperCase();
    const code = toCodeString(item).toUpperCase();
    if (brand.includes('DONALDSON')) return toCodeString(item);
    if (/^P\d{5,6}$/i.test(code) || /^DBL/i.test(code)) return toCodeString(item);
  }
  return null;
}

function findFramCode(crossReference) {
  const list = normalizeList(crossReference);
  for (const item of list) {
    const brand = toBrandString(item).toUpperCase();
    const code = toCodeString(item).toUpperCase();
    if (brand.includes('FRAM')) return toCodeString(item);
    if (/^(PH|CA|CF|CH)\d{3,6}$/i.test(code)) return toCodeString(item);
  }
  return null;
}

function getMostCommonOEM(oemCodes) {
  const list = normalizeList(oemCodes);
  if (list.length === 0) return null;

  const brands = [
    'CATERPILLAR', 'CAT', 'CUMMINS', 'DETROIT', 'VOLVO',
    'MACK', 'PACCAR', 'NAVISTAR', 'INTERNATIONAL', 'FREIGHTLINER',
    'KOMATSU', 'JOHN DEERE', 'CASE', 'NEW HOLLAND', 'DONALDSON'
  ];

  for (const raw of list) {
    const code = toCodeString(raw).toUpperCase();
    const brand = toBrandString(raw).toUpperCase();
    if (brand && brands.some(b => brand.includes(b))) return toCodeString(raw);
    if (!brand && brands.some(b => code.includes(b))) return toCodeString(raw);
  }

  return toCodeString(list[0]);
}

/**
 * Pipeline de procesamiento
 */
function processFilterData(family, specs, oemCodes, crossReference, rawData) {
  validateMasterDataIntegrity(rawData);
  const dutyLevel = determineDutyLevel(family, specs, oemCodes, crossReference, rawData);
  
  // Generar SKU con reglas
  const skuResult = generateSKU(family, dutyLevel, oemCodes, crossReference, rawData);

  return {
    sku: skuResult.sku,
    family: rawData.family,
    specs: rawData.specs,
    duty_level: dutyLevel,
    crossReference,
    oemCodes,
    validated: true,
    timestamp: new Date().toISOString(),
    rules_applied: skuResult.rulesApplied,
    processing_details: skuResult.details
  };
}

// ============================================================================
// EXPORTACIONES
// ============================================================================
module.exports = {
  setRulesMaster,
  determineDutyLevel,
  validateMasterDataIntegrity,
  processFilterData,
  getElimfiltersPrefix,
  applyBaseCodeLogic,
  generateSKU,
  extractLast4Digits,
  findDonaldsonCode,
  findFramCode,
  getMostCommonOEM
};
