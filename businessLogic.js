// businessLogic.js
// Lógica de negocio para determinación de niveles de servicio y generación de SKU
// Ajustado según reglas: prefijos EL8/EF9/EA1/EC1/EH6/EW7/ED4/EK5/EK3/ET9,
// 4 dígitos: HD→Donaldson últimos 4; si no existe, OEM más comercial.
//             LD→Fram últimos 4;     si no existe, OEM más comercial.

function determineDutyLevel(family, specs, oemCodes, crossReference, rawData) {
  if (!rawData) {
    throw new Error('rawData no fue proporcionado. La clasificación de Duty Level requiere data maestra.');
  }
  if (rawData.duty_level && String(rawData.duty_level).trim() !== '') {
    return String(rawData.duty_level).trim().toUpperCase(); // HD / LD
  }
  throw new Error(`Clasificación de Duty Level no definida en la base de datos maestra para SKU: ${rawData.sku || 'desconocido'}`);
}

function validateMasterDataIntegrity(rawData) {
  const required = ['duty_level', 'sku', 'family', 'specs'];
  const missing = required.filter(
    f => rawData[f] == null || (typeof rawData[f] === 'string' && rawData[f].trim() === '')
  );
  if (missing.length > 0) {
    throw new Error(`Campos críticos faltantes en data maestra: ${missing.join(', ')}`);
  }
  return true;
}

// ============================================================================
// PREFIJOS ELIMFILTERS (según instrucciones del cliente)
// ============================================================================
function getElimfiltersPrefix(family, dutyLevel) {
  const fam = String(family || '').trim().toUpperCase();
  const duty = String(dutyLevel || 'HD').trim().toUpperCase(); // por consistencia

  // Mapa de familias → prefijos (ambos HD/LD salvo excepciones)
  // Oil = EL8, Fuel = EF9, Air = EA1, Cabin = EC1, Hydraulic = EH6 (HD),
  // Coolant = EW7 (HD), Air Dryer = ED4 (HD), Kits Diesel = EK5 (HD),
  // Kits Gas = EK3 (LD), Carcazas de aire = EC1 (HD), Turbinas Diesel = ET9 (HD).
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

  // Reglas especiales para kits por duty
  if (fam.includes('KIT')) {
    if (duty === 'HD') return 'EK5';
    if (duty === 'LD') return 'EK3';
  }

  // Reglas especiales por duty cuando aplica:
  if ((fam.includes('HYD') || fam === 'HYDRAULIC') && duty !== 'HD') return 'EH6';
  if ((fam.includes('COOLANT')) && duty !== 'HD') return 'EW7';
  if ((fam.includes('AIR DRYER') || fam.includes('AIR_DRYER')) && duty !== 'HD') return 'ED4';
  if ((fam.includes('CARCASA') || fam.includes('HOUSING')) && duty !== 'HD') return 'EC1';
  if ((fam.includes('TURBINA') || fam.includes('TURBINE')) && duty !== 'HD') return 'ET9';

  return map[fam] || 'EL8'; // default Oil
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
    // soporta {brand, code} u otros
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

// Detecta Donaldson en cross: por brand o patrón común (P + 5 dígitos / P + 6 dígitos)
function findDonaldsonCode(crossReference) {
  const list = normalizeList(crossReference);
  for (const item of list) {
    const brand = toBrandString(item).toUpperCase();
    const code = toCodeString(item).toUpperCase();
    if (brand.includes('DONALDSON')) return toCodeString(item);
    // Patrones típicos Donaldson
    if (/^P\d{5,6}$/i.test(code) || /^DBL/i.test(code)) return toCodeString(item);
  }
  return null;
}

// Detecta FRAM en cross: por brand o patrones PH/CA/CF/CH + dígitos
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
    'KOMATSU', 'JOHN DEERE', 'CASE', 'NEW HOLLAND', 'TOYOTA'
  ];

  for (const raw of list) {
    const code = toCodeString(raw).toUpperCase();
    const brand = toBrandString(raw).toUpperCase();
    if (brand && brands.some(b => brand.includes(b))) return toCodeString(raw);
    if (!brand && brands.some(b => code.includes(b))) return toCodeString(raw);
  }

  // fallback al primero
  return toCodeString(list[0]);
}

function applyBaseCodeLogic(dutyLevel, family, oemCodes, crossReference) {
  const duty = String(dutyLevel || 'HD').toUpperCase();

  let baseCode = null;
  if (duty === 'HD') {
    const don = findDonaldsonCode(crossReference);
    baseCode = don || getMostCommonOEM(oemCodes);
  } else if (duty === 'LD') {
    const fram = findFramCode(crossReference);
    baseCode = fram || getMostCommonOEM(oemCodes);
  } else {
    baseCode = getMostCommonOEM(oemCodes);
  }

  if (!baseCode) {
    throw new Error('No se encontró base code válido en referencias OEM o cross-reference');
  }
  return extractLast4Digits(baseCode);
}

// ============================================================================
// GENERACIÓN DE SKU
// ============================================================================
function generateSKU(family, dutyLevel, oemCodes, crossReference) {
  const prefix = getElimfiltersPrefix(family, dutyLevel);        // p.ej. EL8 / EF9 / EA1 / …
  const last4 = applyBaseCodeLogic(dutyLevel, family, oemCodes, crossReference); // 4 dígitos
  return `${prefix}-${last4}`; // con guion, según ejemplos acordados
}

// ============================================================================
// PIPELINE DE PROCESAMIENTO
// ============================================================================
function processFilterData(family, specs, oemCodes, crossReference, rawData) {
  validateMasterDataIntegrity(rawData);
  const dutyLevel = determineDutyLevel(family, specs, oemCodes, crossReference, rawData);
  return {
    sku: rawData.sku,
    family: rawData.family,
    specs: rawData.specs,
    duty_level: dutyLevel,
    crossReference,
    oemCodes,
    validated: true,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// EXPORTACIONES
// ============================================================================
module.exports = {
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
