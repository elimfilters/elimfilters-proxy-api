// homologationDB.js — genera SKU usando REGLAS MAESTRAS (oficiales)
const fs = require('fs');
const path = require('path');

function normalize(s) {
  return String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
function last4Core(src) {
  const n = normalize(src);
  const tail = n.slice(-4);
  return tail.padStart(4, '0');
}

// Carga reglas desde “REGLAS MAESTRAS” (sin extensión) o desde config/REGLAS_MAESTRAS.json si existe
let _RULES = null;
function loadRules() {
  if (_RULES) return _RULES;

  const candidates = [
    path.resolve(__dirname, 'REGLAS MAESTRAS'),
    path.resolve(__dirname, 'config', 'REGLAS_MAESTRAS.json')
  ];
  let text = null, usedPath = null;

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      text = fs.readFileSync(p, 'utf8');
      usedPath = p;
      break;
    }
  }
  if (!text) throw new Error('REGLAS MAESTRAS no encontrado (ni en raíz ni en config/)');

  try {
    _RULES = JSON.parse(text);
  } catch (e) {
    throw new Error(`REGLAS MAESTRAS inválido (${usedPath}): ${e.message}`);
  }
  return _RULES;
}

function resolvePrefixByDecisionTable(family, duty) {
  const rules = loadRules();
  const dt = rules.decisionTable || {};
  const key = `${String(family || '').toUpperCase()}|${String(duty || '').toUpperCase()}`;
  return dt[key] || null;
}

/**
 * Genera SKU oficial:
 *   SKU = {prefix}{CORE4}, donde CORE4 = últimos 4 alfanuméricos del código origen (left-pad '0').
 *   prefix proviene de decisionTable[family|duty].
 * ctx:
 *   - type: 'OEM' | 'XREF'
 *   - family: 'OIL' | 'FUEL' | 'AIRE' | ... (obligatorio para prefijo correcto)
 *   - duty: 'HD' | 'LD' (obligatorio para prefijo correcto)
 */
function generateSkuFrom(sourceCode, ctx = {}) {
  const core = last4Core(sourceCode);

  const family = ctx.family; // debe venir desde la capa que clasifica
  const duty = ctx.duty;

  // Prefijo desde decisionTable
  const prefix = resolvePrefixByDecisionTable(family, duty);
  if (!prefix) {
    // Fallback explícito para no frenar el flujo, pero avisando en logs
    console.warn('[SKU RULES] Prefijo no resuelto. family/duty faltan o no mapeados:', { family, duty });
    // Mantener compatibilidad mientras integras family/duty: usa prefijo por tipo (temporal)
    const tmp = ctx.type === 'OEM' ? 'EO' : 'EX';
    return `${tmp}${core}`;
  }

  return `${prefix}${core}`;
}

module.exports = { generateSkuFrom, loadRules };
