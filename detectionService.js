// detectionService.js v3.7.0 — FINAL without web search
let _sheetsInstance = null;
const normalizeQuery = require('./normalizeQuery');
const { findEquivalence } = require('../crossReferenceDB');
const OEM_RANKING = require('./config/oemRanking.json');

const OEM_MANUFACTURERS = [
  'CATERPILLAR', 'KOMATSU', 'CUMMINS', 'VOLVO', 'MACK', 'JOHN DEERE',
  'DETROIT DIESEL', 'PERKINS', 'CASE', 'NEW HOLLAND', 'SCANIA',
  'MERCEDES TRUCK', 'KENWORTH', 'PETERBILT', 'FREIGHTLINER',
  'INTERNATIONAL', 'MTU', 'PACCAR', 'HINO', 'IVECO', 'ISUZU', 'FORD',
  'ALLIANCE',
];

const CROSS_MANUFACTURERS = [
  'DONALDSON', 'BALDWIN', 'FRAM', 'FLEETGUARD', 'WIX', 'PUROLATOR',
  'MAN', 'PARKER', 'HENGST', 'KNECHT', 'CHAMPION', 'MANN',
];

const { getPrefix } = require('./rulesProtection');

const FAMILY_RULES = {
  AIR: { patterns: ['AIR', 'CA', 'CF', 'RS', 'EAF', 'P1', 'AF'] },
  OIL: { patterns: ['OIL', '1R', 'PH', 'LF', 'B', 'BT'] },
  FUEL: { patterns: ['FUEL', 'FF', 'FS', 'P77', 'P52'] },
  // Fuel/Water Separators — HD only
  FUEL_SEPARATOR: { patterns: ['SEPARATOR', 'SEPARADOR', 'WATER SEPARATOR'] },
  CABIN: { patterns: ['CABIN', 'AC', 'A/C', 'CUK', 'CU'] },
  // Remove 'H' to avoid false positives like 1000FH → HYDRAULIC
  HYDRAULIC: { patterns: ['HYDRAULIC', 'HF'] },
  COOLANT: { patterns: ['COOLANT', 'REFRIGERANTE'] },
  AIR_DRYER: { patterns: ['DRYER', 'SECANTE'] },
  TURBINE: { patterns: ['TURBINA', 'PARKER'] },
  HOUSING: { patterns: ['HOUSING', 'CARCASA'] },
  KIT_DIESEL: { patterns: ['DIESEL KIT', 'KIT DIESEL'] },
  KIT_GASOLINE: { patterns: ['GASOLINE KIT', 'KIT GASOLINA'] },
};

function isAlreadyCrossReference(query) {
  // Mantener lógica existente basada en prefijos compactos
  const compact = String(query || '').toUpperCase().replace(/[-\s]/g, '');
  const brandDutyMapCross = {
    DONALDSON: 'HD',
    FLEETGUARD: 'HD',
    BALDWIN: 'HD',
    PARKER: 'HD',
    FRAM: 'LD',
    WIX: 'LD',
    PUROLATOR: 'LD',
    MANN: 'LD',
    HENGST: 'LD',
    KNECHT: 'LD',
    CHAMPION: 'LD',
    MAN: 'LD',
  };
  // Nuevo: detección de patrón 'MARCA PARTE' (con espacios o guiones)
  try {
    const normalized = String(query || '').trim().toUpperCase();
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      const possibleBrand = tokens[0];
      if (CROSS_MANUFACTURERS.includes(possibleBrand)) {
        const part = tokens.slice(1).join('').replace(/[^A-Z0-9]/g, '');
        if (part) {
          // No disponemos aquí de detectDuty/detectFamily de forma estable antes; asumimos duty por marca
          const assumedDuty = brandDutyMapCross[possibleBrand] || 'LD';
          return { brand: possibleBrand, duty: assumedDuty, partNumber: part };
        }
      }
    }
    // También soportar forma compacta 'MARCA+PARTE' tras normalizeQuery
    const compactUpper = String(query || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    for (const brand of CROSS_MANUFACTURERS) {
      if (compactUpper.startsWith(brand)) {
        const remainder = compactUpper.slice(brand.length);
        if (remainder && /[A-Z0-9]/.test(remainder)) {
          const assumedDuty = brandDutyMapCross[brand] || 'LD';
          return { brand, duty: assumedDuty, partNumber: remainder };
        }
      }
    }
  } catch (_) {}
  
  if (/^P\d{6}/.test(compact)) {
    return { brand: 'DONALDSON', duty: brandDutyMapCross['DONALDSON'], partNumber: compact };
  }
  
  if (/^(PH|CA|CS|FS|CH|BG|G)\d{4,}/.test(compact)) {
    return { brand: 'FRAM', duty: brandDutyMapCross['FRAM'], partNumber: compact };
  }
  
  if (/^CF\d{5}/.test(compact)) {
    return { brand: 'FRAM', duty: brandDutyMapCross['FRAM'], partNumber: compact };
  }
  
  if (/^(LF|FF|AF|HF)\d{4,}/.test(compact)) {
    return { brand: 'FLEETGUARD', duty: brandDutyMapCross['FLEETGUARD'], partNumber: compact };
  }
  
  if (/^(B|BT|PA)\d{3,}/.test(compact)) {
    return { brand: 'BALDWIN', duty: brandDutyMapCross['BALDWIN'], partNumber: compact };
  }
  
  if (/^(CUK|CU)\d{4}/.test(compact)) {
    return { brand: 'MANN', duty: brandDutyMapCross['MANN'], partNumber: compact };
  }
  
  return null;
}

function detectFamily(query) {
  const q = query.toUpperCase();
  // Exact mapping by Toyota OEM prefix (5 digits) when code is compact numeric
  try {
    const pn = extractPartNumber(q);
    const compact = String(pn).replace(/[-\s]/g, '').toUpperCase();
    const m = compact.match(/^(\d{5})\d{3,}$/);
    if (m) {
      const prefix = m[1];
      const TOYOTA_FAMILY_BY_PREFIX = {
        '87139': 'CABIN',
        '90915': 'OIL',
        '17801': 'AIR',
        '23300': 'FUEL'
      };
      if (TOYOTA_FAMILY_BY_PREFIX[prefix]) {
        return TOYOTA_FAMILY_BY_PREFIX[prefix];
      }
    }
  } catch (_) {}
  // Exact mapping Alliance: ABP/N122-* are Fuel/Water Separator (dedicated family)
  try {
    if (/\bABP\/N122-[A-Z0-9\-]+\b/.test(q)) {
      return 'FUEL_SEPARATOR';
    }
  } catch (_) {}
  // Exact mapping Alliance: ABP/N121-* also are Fuel/Water Separator
  try {
    if (/\bABP\/N121-[A-Z0-9\-]+\b/.test(q)) {
      return 'FUEL_SEPARATOR';
    }
  } catch (_) {}
  // Detección de turbina Racor (Parker) solo cuando hay marca explícita
  if ((q.includes('RACOR') || q.includes('PARKER')) && /\b\d{3,5}F(H|G)\b/.test(q)) {
    return 'TURBINE';
  }
  // Detection of compact Ford code (base 9601 → air element)
  try {
    const pnFord = extractPartNumber(q);
    const compactFord = String(pnFord).replace(/[-\s]/g, '').toUpperCase();
    // Aceptar prefijos alfanuméricos típicos de Ford (3–6 chars), base 9601 y sufijo 1–3 chars
    if (/^[A-Z0-9]{3,6}9601[A-Z0-9]{1,3}$/.test(compactFord)) {
      return 'AIR';
    }
  } catch (_) {}
  for (const [family, { patterns }] of Object.entries(FAMILY_RULES)) {
    if (patterns.some(p => q.includes(p))) return family;
  }
  // Global fallback: if extracted OEM code is numeric only, assume FUEL
  // Avoid typical automotive pattern 5-5 (e.g., 87139-07010)
  try {
    const pn = extractPartNumber(q);
    const compact = String(pn).replace(/[-\s]/g, '');
    const digitsOnly = /^\d+$/.test(compact);
    const isAutomotiveHyphen = /^\d{5}-\d{5}$/.test(String(pn));
    if (digitsOnly && compact.length >= 6 && !isAutomotiveHyphen) {
      return 'FUEL';
    }
  } catch (_) {}
  return 'UNKNOWN';
}

function detectDuty(query, family) {
  const q = query.toUpperCase();

  // Alliance ABP/N122-* → Heavy Duty
  try {
    if (/\bABP\/N122-[A-Z0-9\-]+\b/.test(q)) {
      return 'HD';
    }
  } catch (_) {}
  // Alliance ABP/N121-* → Heavy Duty
  try {
    if (/\bABP\/N121-[A-Z0-9\-]+\b/.test(q)) {
      return 'HD';
    }
  } catch (_) {}
  
  // Infer duty from code patterns when there is no explicit brand
  const part = extractPartNumber(q);
  const p = String(part).toUpperCase();
  
  // LD heuristic: check known automotive exceptions first
  // Toyota/automotive with 5-5 hyphen (e.g., 87139-07010)
  if (/^\d{5}-\d{5}$/.test(p)) return 'LD';
  // Frequent Japanese automotive prefixes (should prevail over long numeric)
  if (/^(87139|90915|17801)\d*/.test(p)) return 'LD';
  
  // HD heuristic: CATERPILLAR "1R" + digits (e.g., 1R1807), Donaldson Pxxxxxx is captured as crossRef
  if (/^1R\d{4,}$/.test(p)) return 'HD';
  // Additional HD heuristic: long numeric OEM codes without hyphens (many heavy OEMs use 7–9 digits)
  // Except Japanese automotive prefixes already handled above
  if (/^\d{7,}$/.test(p)) return 'HD';
  
  if (OEM_MANUFACTURERS.some(m => q.includes(m))) return 'HD';
  if (['TOYOTA', 'FORD', 'NISSAN', 'MAZDA', 'LEXUS', 'BMW', 'MERCEDES', 'AUDI', 'PORSCHE', 'VOLKSWAGEN'].some(m => q.includes(m))) return 'LD';
  if (['KIT_DIESEL', 'HYDRAULIC', 'TURBINE', 'AIR_DRYER'].includes(family)) return 'HD';
  return 'UNKNOWN';
}

function detectSource(query) {
  const q = query.toUpperCase();
  
  const crossRef = isAlreadyCrossReference(q);
  if (crossRef) return crossRef.brand;
  
  // OEM heuristic: CATERPILLAR codes of type 1Rxxxx
  const compact = q.replace(/[-\s]/g, '');
  // Alliance ABP/N122-* → ALLIANCE
  try {
    const pn = extractPartNumber(q) || '';
    if (String(pn).toUpperCase().startsWith('ABP/N122-')) return 'ALLIANCE';
    if (/\bABP\/N122-[A-Z0-9\-]+\b/.test(q)) return 'ALLIANCE';
  } catch (_) {}
  // Alliance ABP/N121-* → ALLIANCE
  try {
    const pn121 = extractPartNumber(q) || '';
    if (String(pn121).toUpperCase().startsWith('ABP/N121-')) return 'ALLIANCE';
    if (/\bABP\/N121-[A-Z0-9\-]+\b/.test(q)) return 'ALLIANCE';
  } catch (_) {}
  if (/^1R\d{4,}$/.test(compact)) return 'CATERPILLAR';
  // Ford heuristic: compact codes with base 9601
  if (/^[A-Z0-9]{3,6}9601[A-Z0-9]{1,3}$/.test(compact)) return 'FORD';
  
  if (CROSS_MANUFACTURERS.some(m => q.includes(m))) return CROSS_MANUFACTURERS.find(m => q.includes(m));
  if (OEM_MANUFACTURERS.some(m => q.includes(m))) return OEM_MANUFACTURERS.find(m => q.includes(m));
  return 'GENERIC';
}

function extractPartNumber(query) {
  const patterns = [
  // Prioritize typical Japanese automotive pattern 5-5 (e.g., 90915-10003, 87139-07010)
    /\b\d{5}-\d{5}\b/,
    /\b[A-Z]{1,3}[-\s]?\d{4,}\b/i,
    /\b\d{3,}[-]?\d{3,}[-]?\d{3,}\b/,
    /\b[A-Z]{2}\d{4,}\b/i,
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return match[0].replace(/\s/g, '');
  }
  
  // Fallback: if there is a long alphanumeric segment, prefer the one containing digits and letters;
  // if the query includes a hyphen, try to take the entire block around the hyphen
  const hyphenCombo = query.match(/\b[A-Z0-9]{3,}-[A-Z0-9]{3,}\b/i);
  if (hyphenCombo) return hyphenCombo[0];
  const fallback = query.match(/[A-Z0-9]{5,}/i);
  return fallback ? fallback[0] : query;
}

function mapFamilyForPrefix(family) {
  const f = String(family || '').toUpperCase();
  if (f === 'AIR') return 'AIRE';
  if (f === 'FUEL_SEPARATOR') return 'FUEL SEPARATOR';
  if (f === 'AIR_DRYER') return 'AIR DRYER';
  if (f === 'HYDRAULIC') return 'HIDRAULIC';
  if (f === 'TURBINE') return 'TURBINE SERIES';
  if (f === 'HOUSING') return 'CARCAZA AIR FILTER';
  if (f === 'KIT_DIESEL') return 'KITS SERIES HD';
  if (f === 'KIT_GASOLINE') return 'KITS SERIES LD';
  return f;
}

function generateSkuFromPartNumber(family, partNumber, duty = 'HD') {
  const normalizedFamily = mapFamilyForPrefix(family);
  const prefix = getPrefix(normalizedFamily, String(duty || 'HD').toUpperCase());
  if (!prefix) return '';
  const alnum = String(partNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const lastFour = alnum.slice(-4).padStart(4, '0');
  return prefix + lastFour;
}

// Select most commercial OEM when there is no Donaldson/FRAM
function parseListField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/[,;\n]+/)
    .map(v => String(v).trim())
    .filter(Boolean);
}

function isCrossManufacturerCode(code) {
  const c = String(code || '').toUpperCase();
  // Heuristic: matches patterns of known cross manufacturers
  if (/^P\d{6}$/.test(c)) return true; // Donaldson
  if (/^(PH|CA|CS|FS|CH|BG|G)\d{4,}$/.test(c)) return true; // FRAM
  if (/^(LF|FF|AF|HF)\d{4,}$/.test(c)) return true; // Fleetguard
  if (/^(B|BT|PA)\d{3,}$/.test(c)) return true; // Baldwin
  if (/^(CUK|CU)\d{4}$/.test(c)) return true; // MANN
  return false;
}

function selectMostCommercialOEMFromRow(row) {
  if (!row) return null;
  // 1) Usar priority_reference si existe
  const pr = row['priority_reference'] || row['priority_brand_reference'] || '';
  if (String(pr).trim()) return String(pr).trim();

  // 2) Probar oem_codes
  const oemCandidates = parseListField(row['oem_codes']);
  const oemValid = oemCandidates.filter(c => !isCrossManufacturerCode(c));
  if (oemValid.length) return oemValid[0];

  // 3) Probar all_cross_references y filtrar solo OEM (no cross manufacturers)
  const allRefs = parseListField(row['all_cross_references']);
  const oemLike = allRefs.filter(c => !isCrossManufacturerCode(c));
  if (oemLike.length) return oemLike[0];

  return null;
}

async function selectOEMForLast4(partNumber, sheets) {
  try {
    if (!sheets) return partNumber;
    // Buscar fila completa por query_norm si está disponible
    const queryNorm = normalizeQuery(partNumber);
    const fullRow = await sheets.findRowByQuery(queryNorm);
    const picked = selectMostCommercialOEMFromRow(fullRow);
    return picked || partNumber;
  } catch (_e) {
    return partNumber;
  }
}

// Canonizar marca usando sinónimos
function canonicalizeBrand(brand) {
  const b = String(brand || '').toUpperCase().trim();
  if (!b) return '';
  const synonyms = OEM_RANKING.synonyms || {};
  // Si ya está en ranking global, devolver tal cual
  const inGlobal = (OEM_RANKING.ranking?.GLOBAL?.HD || []).includes(b) || (OEM_RANKING.ranking?.GLOBAL?.LD || []).includes(b);
  if (inGlobal) return b;
  for (const canon of Object.keys(synonyms)) {
    if (canon.toUpperCase() === b) return canon.toUpperCase();
    const arr = synonyms[canon] || [];
    if (arr.map(x => String(x).toUpperCase()).includes(b)) return canon.toUpperCase();
  }
  return b;
}

function resolveRegion() {
  // Selección global fija para consistencia mundial
  return 'GLOBAL';
}

function pickByRanking(family, duty, candidates) {
  try {
    const region = resolveRegion();
    const rankingBase = (OEM_RANKING.ranking?.[region]?.[String(duty || '').toUpperCase()]) || (OEM_RANKING.ranking?.GLOBAL?.[String(duty || '').toUpperCase()]) || [];
    const overridesRegion = OEM_RANKING.family_overrides?.[region] || {};
    const overridesGlobal = OEM_RANKING.family_overrides?.GLOBAL || {};
    const fam = String(family || '').toUpperCase();
    const overrideList = overridesRegion[fam] || overridesGlobal[fam] || [];
    const effectiveRanking = [...overrideList.map(s => String(s).toUpperCase()), ...rankingBase.map(s => String(s).toUpperCase())];

    const mapped = (candidates || []).map(code => {
      const brand = detectSource(String(code || ''));
      const canon = canonicalizeBrand(brand);
      return { code: String(code || ''), brand: canon };
    });

    for (const brand of effectiveRanking) {
      const hit = mapped.find(m => m.brand === brand);
      if (hit && String(hit.code).trim()) return hit.code;
    }
    return (candidates || [])[0] || '';
  } catch (_e) {
    return (candidates || [])[0] || '';
  }
}

async function selectOEMForLast4Ranked(partNumber, family, duty, sheets) {
  try {
    if (!sheets) return partNumber;
    const queryNorm = normalizeQuery(partNumber);
    const fullRow = await sheets.findRowByQuery(queryNorm);
    if (!fullRow) return partNumber;
    const oemCandidates = parseListField(fullRow['oem_codes']).filter(c => !isCrossManufacturerCode(c));
    const oemLike = parseListField(fullRow['all_cross_references']).filter(c => !isCrossManufacturerCode(c));
    const merged = [...oemCandidates, ...oemLike].filter(Boolean);
    if (!merged.length) {
      const fallback = selectMostCommercialOEMFromRow(fullRow);
      return fallback || partNumber;
    }
    const chosen = pickByRanking(family, duty, merged);
    return chosen || partNumber;
  } catch (_e) {
    return partNumber;
  }
}

/**
 * Función principal con búsqueda en 2 niveles
 */
function setSheetsInstance(instance) {
  _sheetsInstance = instance;
}

function deriveSubtype(family, usedPartNumber, crossBrand) {
  try {
    const fam = String(family || '').toUpperCase();
    const pn = String(usedPartNumber || '').toUpperCase();
    const brand = String(crossBrand || '').toUpperCase();

    // AIR: heurísticas simples por prefijo
  if (fam === 'AIR') {
      // Base 9601 en códigos Ford suele ser filtro de aire tipo panel
      if (/9601/.test(pn)) return 'PANEL';
      if (/^CA\d+/.test(pn) || pn.includes('EAF')) return 'PANEL';
      if (pn.includes('RS') || /^CF\d+/.test(pn)) return 'ROUND';
      return 'ROUND';
  }
    // FUEL: PRIMARY/SECONDARY por patrones típicos
    if (fam === 'FUEL') {
      if (brand === 'DONALDSON') {
        if (/^P55\d+/.test(pn) || /^FF\d+/.test(pn)) return 'PRIMARY';
        if (/^P77\d+/.test(pn) || /^P52\d+/.test(pn) || /^FS\d+/.test(pn)) return 'SECONDARY';
      }
      if (brand === 'FRAM') {
        if (/^FF\d+/.test(pn)) return 'PRIMARY';
        if (/^FS\d+/.test(pn)) return 'SECONDARY';
      }
      return 'PRIMARY';
    }
    // FUEL_SEPARATOR: siempre SEPARATOR
    if (fam === 'FUEL_SEPARATOR') {
      return 'SEPARATOR';
    }
    // OIL: SPIN-ON/CARTRIDGE
    if (fam === 'OIL') {
      if (/^PH\d+/.test(pn) || /^LF\d+/.test(pn) || /^B\d+/.test(pn) || /^BT\d+/.test(pn)) return 'SPIN-ON';
      if (/^CH\d+/.test(pn)) return 'CARTRIDGE';
      return 'SPIN-ON';
    }
    // HYDRAULIC: SPIN-ON por HF, sino CARTRIDGE
    if (fam === 'HYDRAULIC') {
      if (/^HF\d+/.test(pn)) return 'SPIN-ON';
      return 'CARTRIDGE';
    }
    // CABIN: carbón activado / estándar
    if (fam === 'CABIN') {
      if (/^CUK\d+/.test(pn)) return 'CARBON';
      return 'STANDARD';
    }
    if (fam === 'COOLANT') return 'STANDARD';
    if (fam === 'TURBINE') return 'ASSEMBLY';
    if (fam === 'AIR_DRYER') return 'CARTRIDGE';
    if (fam === 'KIT_DIESEL' || fam === 'KIT_GASOLINE') return 'KIT';
    if (fam === 'HOUSING') return 'HOUSING';
    return '';
  } catch (_) {
    return '';
  }
}

async function detectFilter(queryRaw, sheetsInstance = null) {
  const query = normalizeQuery(queryRaw);
  let family = detectFamily(query);
  const duty = detectDuty(query, family);
  const source = detectSource(query);
  const partNumber = extractPartNumber(query);
  
  const directCross = isAlreadyCrossReference(query);
  
  let sku;
  let usedPartNumber;
  let crossBrand = 'N/A';
  let crossPartNumber = 'N/A';
  let oemNumber = partNumber;
  let manufacturedBy = 'UNCONFIRMED';
  let last4Source = 'unknown';
  let supersessionApplied = false;
  let originalCrossPart = '';
  let originalCrossBrand = '';

  const requireReplacement = String(process.env.REQUIRE_REPLACEMENT_FOR_DISCONTINUED || 'true').toLowerCase() === 'true';
  const forceNewOnSupersession = String(process.env.FORCE_NEW_SKU_ON_SUPERSESSION || 'false').toLowerCase() === 'true';
  const isDiscontinuedStatus = (status) => {
    const s = String(status || '').toUpperCase();
    // Cobertura inglés/español: DISCONTINUED, OBSOLETE/OBSOLETO, RETIRED, BAJA, DESCATALOGADO
    return /DISCONT|OBSOLET|OBSOLETO|DESCONTIN|RETIRED|BAJA|DESCATAL/.test(s);
  };
  
  if (directCross) {
    // Ya es cross-reference directo: intentar reutilizar SKU desde Master por pareja homologada
    const sheets = sheetsInstance || _sheetsInstance;
    if (sheets) {
      // Si el código Donaldson/FRAM está descontinuado, usar el que lo sustituye
      try {
        const sup = await sheets.findSupersessionForCross(directCross.brand, directCross.partNumber);
        if (sup && sup.replacement_part_number) {
          console.log(`🔁 Supersession detectado para ${directCross.brand} ${directCross.partNumber} → usar ${sup.replacement_part_number}`);
          directCross.partNumber = String(sup.replacement_part_number).trim();
          supersessionApplied = true;
        } else if (sup && isDiscontinuedStatus(sup.status) && requireReplacement) {
          const err = new Error('DISCONTINUED_NO_REPLACEMENT');
          err.context = { brand: directCross.brand, part_number: directCross.partNumber };
          throw err;
        }
      } catch (_e) {}
      const row = await sheets.findRowByCrossPair(directCross.brand, directCross.partNumber);
      if (row && row.sku) {
        if (!(supersessionApplied && forceNewOnSupersession)) {
          sku = String(row.sku).trim();
          // Reutilizar familia si existe en Master
          if (row.family) {
            const famFromRow = String(row.family).trim();
            if (famFromRow) {
              // family es let más abajo; aquí podría ser const; ajustamos más tarde
            }
          }
          console.log(`♻️ Reutilizando SKU existente por cross pair: ${directCross.brand} ${directCross.partNumber} → SKU: ${sku}`);
        } else {
          console.log('⏭️ Supersession con flag FORCE_NEW_SKU_ON_SUPERSESSION: no reutilizar SKU homologado');
        }
      }
    }
    if (!sku) {
      sku = generateSkuFromPartNumber(family, directCross.partNumber, duty);
    }
    // Si es Parker/Racor (turbina) ajustar familia a TURBINE antes de respuesta
    const isRacorTurbine = /\b\d{3,5}F(H|G)\b/.test(directCross.partNumber) || directCross.brand.includes('PARKER');
    if (isRacorTurbine) {
      // Recalcular sku si family cambia a TURBINE
      const desiredFamily = 'TURBINE';
      if (family !== desiredFamily) {
        family = desiredFamily;
        // Si no se reutilizó SKU, ajustar al prefijo correcto TURBINE (ET9)
        if (!sku || sku.startsWith('EH') || sku.startsWith('EF') || sku.startsWith('EL')) {
          sku = generateSkuFromPartNumber(family, directCross.partNumber, duty);
        }
      }
    }
    usedPartNumber = directCross.partNumber;
    crossBrand = directCross.brand;
    crossPartNumber = directCross.partNumber;
    originalCrossPart = directCross.partNumber;
    originalCrossBrand = directCross.brand;
    manufacturedBy = directCross.brand;
    last4Source = 'cross';
    oemNumber = 'N/A';
    // Enriquecer fila Master con el código consultado como cross_reference
    try {
      const sheets = sheetsInstance || _sheetsInstance;
      if (sheets) {
        await sheets.appendReferencesToCrossPairRow(crossBrand, crossPartNumber, {
          cross_reference: `${crossBrand} ${crossPartNumber}`
        });
      }
    } catch (_e) {}
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
        // Preferir DONALDSON si existe; de lo contrario usar FRAM
        const targetPart = sheetsCross.donaldson || sheetsCross.fram;
        const targetBrand = sheetsCross.donaldson ? 'DONALDSON' : (sheetsCross.fram ? 'FRAM' : null);
        if (targetPart && targetBrand) {
          // Supersession para Donaldson/FRAM
          let resolvedPart = targetPart;
          try {
            const sup = await sheets.findSupersessionForCross(targetBrand, targetPart);
            if (sup && sup.replacement_part_number) {
              console.log(`🔁 Supersession detectado para ${targetBrand} ${targetPart} → usar ${sup.replacement_part_number}`);
              resolvedPart = String(sup.replacement_part_number).trim();
              supersessionApplied = true;
              originalCrossPart = targetPart;
              originalCrossBrand = targetBrand;
            } else if (sup && isDiscontinuedStatus(sup.status) && requireReplacement) {
              const err = new Error('DISCONTINUED_NO_REPLACEMENT');
              err.context = { brand: targetBrand, part_number: targetPart };
              throw err;
            }
          } catch (_e) {}
          equivalence = {
            brand: targetBrand,
            partNumber: resolvedPart,
            family: sheetsCross.family || family
          };
          console.log(`📗 Equivalencia encontrada en Google Sheets: ${equivalence.brand} ${equivalence.partNumber}`);
        }
      }
    }
    
    if (equivalence) {
      // Propagar familia desde la equivalencia si está disponible
      let resolvedFamily = equivalence.family || family;

      // Intentar reutilizar SKU existente en Master por pareja homologada
      const sheets = sheetsInstance || _sheetsInstance;
      if (sheets) {
        const row = await sheets.findRowByCrossPair(equivalence.brand, equivalence.partNumber);
        if (row && row.sku) {
          if (!(supersessionApplied && forceNewOnSupersession)) {
            sku = String(row.sku).trim();
            if (row.family) {
              const famFromRow = String(row.family).trim();
              if (famFromRow) resolvedFamily = famFromRow;
            }
            console.log(`♻️ Reutilizando SKU existente por cross pair: ${equivalence.brand} ${equivalence.partNumber} → SKU: ${sku}`);
          } else {
            console.log('⏭️ Supersession con flag FORCE_NEW_SKU_ON_SUPERSESSION: no reutilizar SKU homologado');
          }
        }
      }

      if (!sku) {
        sku = generateSkuFromPartNumber(resolvedFamily, equivalence.partNumber, duty);
      }
      usedPartNumber = equivalence.partNumber;
      crossBrand = equivalence.brand;
      crossPartNumber = equivalence.partNumber;
      if (!originalCrossPart) originalCrossPart = equivalence.partNumber;
      if (!originalCrossBrand) originalCrossBrand = equivalence.brand;
      manufacturedBy = equivalence.brand; // DONALDSON para HD, FRAM para LD si existe
      last4Source = 'cross';
      oemNumber = partNumber;
      // Enriquecer fila Master con OEM y cross ref
      try {
        const sheets = sheetsInstance || _sheetsInstance;
        if (sheets) {
          await sheets.appendReferencesToCrossPairRow(crossBrand, crossPartNumber, {
            oem_code: partNumber,
            cross_reference: `${crossBrand} ${crossPartNumber}`
          });
        }
      } catch (_e) {}
      console.log(`✅ Equivalencia confirmada: OEM ${partNumber} → ${equivalence.brand} ${equivalence.partNumber} → SKU: ${sku}`);
      // Actualizar family para la respuesta final
      family = resolvedFamily;
  } else {
    // No encontró equivalencia - usar OEM
    const preferredOEM = await selectOEMForLast4Ranked(partNumber, family, duty, sheets);
    sku = generateSkuFromPartNumber(family, preferredOEM, duty);
    usedPartNumber = preferredOEM;
    oemNumber = partNumber;
    // Confirmar fabricante por ranking si se detecta marca
    const detectedBrand = canonicalizeBrand(detectSource(preferredOEM));
    manufacturedBy = OEM_MANUFACTURERS.includes(detectedBrand) ? detectedBrand : (OEM_MANUFACTURERS.includes(source) ? source : 'UNCONFIRMED');
    // Fuente de últimos 4: ranking OEM
    last4Source = 'oem_ranked';
    console.log(`⚠️ Sin cross-reference confirmada: ${partNumber} → familia=${family} → SKU=${sku || 'N/A'}`);
  }
  }
  
  // Extra: incluir los 4 caracteres usados para el SKU (alfanuméricos)
  let last4Digits = String(usedPartNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-4).padStart(4, '0');
  const subtype = deriveSubtype(family, usedPartNumber, crossBrand);
  const dutyFinal = (String(crossBrand).toUpperCase() === 'FRAM'
    || String(manufacturedBy).toUpperCase() === 'FRAM'
    || String(source).toUpperCase() === 'FRAM') ? 'LD' : duty;

  // Para cualquier duty/familia: si el código tiene sufijo OEM hifenado numérico, priorizarlo para last4_digits
  try {
    const raw = String(queryRaw || '');
    const suffix = raw.match(/-(\d{3,})$/);
    if (suffix) {
      const sufDigits = String(suffix[1] || '').replace(/\D/g, '');
      if (sufDigits.length > 0) {
        last4Digits = sufDigits.slice(-4).padStart(4, '0');
        last4Source = 'oem_suffix';
      }
    }
  } catch (_) {}

  // Verificación explícita de fabricación por marcas clave
  const donaldsonFabricates = String(manufacturedBy || '').toUpperCase() === 'DONALDSON';
  const framFabricates = String(manufacturedBy || '').toUpperCase() === 'FRAM';
  // Resumen compacto para trazabilidad (usa console.log porque dist-server no define debugLog)
  if (String(process.env.SCRAPE_DEBUG || '').toLowerCase() === 'true') {
    const brandSummary = crossBrand && crossBrand !== 'N/A' ? crossBrand : manufacturedBy;
    const refsCount = Array.isArray(allCrossReferences) ? allCrossReferences.length : 0;
    const oemCount = Array.isArray(oemCodes) ? oemCodes.length : 0;
    console.log(`[DETECTION] summary brand=${String(brandSummary || '').toUpperCase()} pn=${usedPartNumber || ''} family=${family} duty=${dutyFinal} sku=${sku || ''} refs=${refsCount} oem=${oemCount} last4=${last4Digits} src=${last4Source}`);
  }

  // Validación estricta del SKU: prefijo aplicable y 4 alfanuméricos
  const normalizedFamilyForPrefix = mapFamilyForPrefix(family);
  const expectedPrefix = getPrefix(normalizedFamilyForPrefix, String(dutyFinal || 'HD').toUpperCase());
  const hasValidPrefix = !!expectedPrefix && typeof sku === 'string' && sku.startsWith(expectedPrefix);
  const hasValidLast4 = /^[A-Z0-9]{4}$/.test(String(last4Digits || ''));
  const endsWithLast4 = typeof sku === 'string' && sku.length >= 7 && sku.slice(-4).toUpperCase() === String(last4Digits || '').toUpperCase();
  const ok = !!(hasValidPrefix && hasValidLast4 && endsWithLast4);

  return {
    query_norm: query,
    sku,
    family,
    duty: dutyFinal,
    source,
    oem_number: oemNumber,
    cross_brand: crossBrand,
    cross_part_number: crossPartNumber,
    supersession_applied: !!supersessionApplied,
    original_cross_part: originalCrossPart || '',
    original_cross_brand: originalCrossBrand || '',
    force_new_sku_on_supersession: !!supersessionApplied && !!forceNewOnSupersession,
    // Bandera de fabricación por Donaldson/FRAM
    donaldson_fabrica: donaldsonFabricates,
    fram_fabrica: framFabricates,
    homologated_sku: sku,
    filter_type: (function mapFilterType(fam) {
      const f = String(fam || '').toUpperCase();
      if (!f || f === 'UNKNOWN') return '';
      if (f === 'FUEL_SEPARATOR') return 'FUEL/WATER SEPARATOR FILTER';
      return `${f} FILTER`;
    })(family),
    subtype,
    media_type: (function mapElimMediaType(fam) {
      const f = String(fam || '').toUpperCase();
      const withTM = (s) => {
        const base = String(s || '').trim();
        return base ? (base.endsWith(' TradeMarket (TM)') ? base : `${base} TradeMarket (TM)`) : '';
      };
      // ELIMFILTERS tecnologías propietarias: ELIMTEK TradeMarket (TM) (líquidos), MACROCORE TradeMarket (TM) (aire), MICROKAPPA TradeMarket (TM) (cabina)
      if (['FUEL','FUEL_SEPARATOR','OIL','HYDRAULIC','COOLANT'].includes(f)) return withTM('ELIMTEK');
      if (f === 'AIR') return withTM('MACROCORE');
      if (f === 'CABIN') return withTM('MICROKAPPA');
      return '';
    })(family),
    description: `Filtro homologado tipo ${family} para aplicación ${dutyFinal === 'HD' ? 'Heavy Duty' : 'Light Duty'}`,
    manufactured_by: manufacturedBy,
    last4_source: last4Source,
    last4_digits: last4Digits,
    ok,
  };
}

// Verificación explícita de fabricante según duty: DONALDSON para HD, FRAM para LD
async function verifyManufacturer(queryRaw, sheetsInstance = null) {
  const DUTY_SECTORS = require('./config/dutySectors.json');
  const CROSS_HD = Array.isArray(DUTY_SECTORS.CROSS_HD) ? DUTY_SECTORS.CROSS_HD.map(s => String(s).toUpperCase()) : [];
  const CROSS_LD = Array.isArray(DUTY_SECTORS.CROSS_LD) ? DUTY_SECTORS.CROSS_LD.map(s => String(s).toUpperCase()) : [];
  const OEM_HD = Array.isArray(DUTY_SECTORS.OEM_HD) ? DUTY_SECTORS.OEM_HD.map(s => String(s).toUpperCase()) : [];
  const OEM_LD = Array.isArray(DUTY_SECTORS.OEM_LD) ? DUTY_SECTORS.OEM_LD.map(s => String(s).toUpperCase()) : [];

  const resolveSector = (manufacturer, dutyVal) => {
    const m = String(manufacturer || '').toUpperCase();
    const region = String(process.env.DUTY_REGION || process.env.REGION || '').toUpperCase();
    if (region && DUTY_SECTORS.region_overrides && DUTY_SECTORS.region_overrides[region]) {
      const override = String(DUTY_SECTORS.region_overrides[region][m] || '').toUpperCase();
      if (override === 'HD' || override === 'LD') return override;
    }
    if (dutyVal === 'HD' || dutyVal === 'LD') return dutyVal;
    if (CROSS_HD.includes(m) || OEM_HD.includes(m)) return 'HD';
    if (CROSS_LD.includes(m) || OEM_LD.includes(m)) return 'LD';
    return null;
  };
  const query = normalizeQuery(queryRaw);
  const family = detectFamily(query);
  const duty = detectDuty(query, family);
  const partNumber = extractPartNumber(query);
  const source = detectSource(query);

  const directCross = isAlreadyCrossReference(query);
  if (directCross) {
    const brandDutyMap = {
      DONALDSON: 'HD',
      FLEETGUARD: 'HD',
      BALDWIN: 'HD',
      FRAM: 'LD',
      WIX: 'LD',
      PUROLATOR: 'LD',
      MANN: 'LD'
    };
    const dutyResolved = brandDutyMap[directCross.brand] || duty;
    const _res = { duty: dutyResolved, sector: resolveSector(directCross.brand, dutyResolved), manufacturer: directCross.brand, partNumber: directCross.partNumber, confirmed: true };
    if (String(process.env.SCRAPE_DEBUG || '').toLowerCase() === 'true') {
      console.log(`[VERIFY] summary source=directCross duty=${dutyResolved} sector=${_res.sector} manufacturer=${String(_res.manufacturer || '')} pn=${String(_res.partNumber || '')} confirmed=${_res.confirmed}`);
    }
    return _res;
  }

  // Validación por datos reales en Master: si existe fila con manufactured_by, usarla
  try {
    const sheets = sheetsInstance || _sheetsInstance;
    if (sheets) {
      const masterRow = await sheets.findRowByQuery(partNumber || query);
      const mb = masterRow && masterRow.manufactured_by ? String(masterRow.manufactured_by).trim() : '';
      if (mb) {
        const canon = canonicalizeBrand(mb);
        const pn = masterRow.oem_number || partNumber;
        const _res = { duty, sector: resolveSector(canon, duty), manufacturer: canon, partNumber: pn, confirmed: true };
        if (String(process.env.SCRAPE_DEBUG || '').toLowerCase() === 'true') {
          console.log(`[VERIFY] summary source=masterRow duty=${duty} sector=${_res.sector} manufacturer=${String(_res.manufacturer || '')} pn=${String(_res.partNumber || '')} confirmed=${_res.confirmed}`);
        }
        return _res;
      }
    }
  } catch (_e) {}

  let equivalence = findEquivalence(partNumber, duty);
  const sheets = sheetsInstance || _sheetsInstance;
  if (!equivalence && sheets) {
    const sheetsCross = await sheets.findCrossReference(partNumber);
    if (sheetsCross) {
      // Preferir DONALDSON si existe; de lo contrario usar FRAM
      const targetPart = sheetsCross.donaldson || sheetsCross.fram;
      const targetBrand = sheetsCross.donaldson ? 'DONALDSON' : (sheetsCross.fram ? 'FRAM' : null);
      if (targetPart && targetBrand) {
        equivalence = {
          brand: targetBrand,
          partNumber: targetPart
        };
      }
    }
  }

  if (equivalence) {
    const _res = { duty, sector: resolveSector(equivalence.brand, duty), manufacturer: equivalence.brand, partNumber: equivalence.partNumber, confirmed: true };
    if (String(process.env.SCRAPE_DEBUG || '').toLowerCase() === 'true') {
      console.log(`[VERIFY] summary source=equivalence duty=${duty} sector=${_res.sector} manufacturer=${String(_res.manufacturer || '')} pn=${String(_res.partNumber || '')} confirmed=${_res.confirmed}`);
    }
    return _res;
  }
  // Confirmar fabricante si el código pertenece a un OEM válido
  if (OEM_MANUFACTURERS.includes(source)) {
    const _res = { duty, sector: resolveSector(source, duty), manufacturer: source, partNumber: partNumber, confirmed: true };
    if (String(process.env.SCRAPE_DEBUG || '').toLowerCase() === 'true') {
      console.log(`[VERIFY] summary source=oemValid duty=${duty} sector=${_res.sector} manufacturer=${String(_res.manufacturer || '')} pn=${String(_res.partNumber || '')} confirmed=${_res.confirmed}`);
    }
    return _res;
  }
  {
    const _res = { duty, sector: resolveSector(null, duty), manufacturer: null, partNumber: partNumber, confirmed: false };
    if (String(process.env.SCRAPE_DEBUG || '').toLowerCase() === 'true') {
      console.log(`[VERIFY] summary source=unknown duty=${duty} sector=${_res.sector} manufacturer=${String(_res.manufacturer || '')} pn=${String(_res.partNumber || '')} confirmed=${_res.confirmed}`);
    }
    return _res;
  }
}

modul
