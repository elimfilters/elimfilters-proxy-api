/**
 * homologationDB.js
 * Reglas de SKU: PREFIJO + CORE_NUMÉRICO_4
 * - CORE = 4 dígitos puros.
 * - Si el código termina en letras, se toman los 4 dígitos inmediatamente anteriores.
 * - Si termina en dígitos, se toman los últimos 4.
 * - Si hay <4 dígitos, se completa con ceros a la izquierda.
 * - Nunca incluye letras en el CORE.
 */

const fs = require('fs');
const path = require('path');

// ---------- Utils ----------
const clean = (s) => String(s ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');

/** Devuelve 4 dígitos numéricos según las reglas definidas */
function coreNumeric4(src) {
  const c = clean(src);

  // Caso 1: ...<digits><letters> (ej: 1000FH) -> usa los dígitos antes de las letras
  let m = c.match(/(\d+)[A-Z]+$/);
  if (m && m[1]) return m[1].slice(-4).padStart(4, '0');

  // Caso 2: ...<digits> (ej: P551313) -> usa los últimos dígitos
  m = c.match(/(\d+)$/);
  if (m && m[1]) return m[1].slice(-4).padStart(4, '0');

  // Sin dígitos
  return '0000';
}

// ---------- Carga de reglas ----------
let RULES_CACHE = null;

/** Carga el JSON de reglas. Busca primero "REGLAS MAESTRAS", luego config/REGLAS_MAESTRAS.json */
function loadRules() {
  if (RULES_CACHE) return RULES_CACHE;

  const candidates = [
    path.join(__dirname, 'REGLAS MAESTRAS'),
    path.join(__dirname, 'config', 'REGLAS_MAESTRAS.json'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      RULES_CACHE = JSON.parse(raw);
      return RULES_CACHE;
    }
  }
  throw new Error('REGLAS MAESTRAS no encontrado');
}

/** Obtiene el prefijo desde la decisionTable usando FAMILY|DUTY */
function prefixOf(family, duty) {
  const rules = loadRules();
  const dt = rules?.decisionTable || {};
  const key = `${String(family || '').toUpperCase()}|${String(duty || '').toUpperCase()}`;
  return dt[key] || null;
}

// ---------- API principal ----------
/**
 * Genera el SKU: PREFIX + CORE(4 dígitos)
 * ctx: { type: 'OEM'|'XREF', family: '...', duty: 'HD'|'LD' }
 */
function generateSkuFrom(sourceCode, ctx = {}) {
  const core = coreNumeric4(sourceCode);
  const px = prefixOf(ctx.family, ctx.duty);
  const fallback = ctx.type === 'OEM' ? 'EO' : 'EX';
  return `${px || fallback}${core}`;
}

module.exports = {
  generateSkuFrom,
  loadRules,
  // utilidades exportadas para pruebas
  _internals: { clean, coreNumeric4, prefixOf },
};
