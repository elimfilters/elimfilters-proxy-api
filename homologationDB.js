// Generación de SKU leyendo tus reglas oficiales (“REGLAS MAESTRAS”)
const fs = require('fs');
const path = require('path');

function normalize(s) {
  return String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
function coreLast4(src) {
  const n = normalize(src);
  const t = n.slice(-4);
  return t.padStart(4, '0');
}

let _RULES = null;
function loadRules() {
  if (_RULES) return _RULES;

  const candidates = [
    path.resolve(__dirname, 'REGLAS MAESTRAS'),                // como lo tienes hoy
    path.resolve(__dirname, 'config', 'REGLAS_MAESTRAS.json')  // alterno
  ];

  let text = null, used = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { text = fs.readFileSync(p, 'utf8'); used = p; break; }
  }
  if (!text) throw new Error('REGLAS MAESTRAS no encontrado');

  try { _RULES = JSON.parse(text); }
  catch (e) { throw new Error(`REGLAS MAESTRAS inválido (${used}): ${e.message}`); }
  return _RULES;
}

function prefixFromDecisionTable(family, duty) {
  const rules = loadRules();
  const dt = rules.decisionTable || {};
  const key = `${String(family||'').toUpperCase()}|${String(duty||'').toUpperCase()}`;
  return dt[key] || null;
}

/**
 * SKU oficial = {prefix}{CORE4}
 * CORE4 = últimos 4 alfanuméricos del código origen (left-pad con '0' si falta).
 * ctx: { type: 'OEM'|'XREF', family: 'OIL'|..., duty: 'HD'|'LD' }
 */
function generateSkuFrom(sourceCode, ctx = {}) {
  const core = coreLast4(sourceCode);
  const family = ctx.family;
  const duty   = ctx.duty;

  const prefix = prefixFromDecisionTable(family, duty);
  if (!prefix) {
    console.warn('[SKU RULES] Prefijo no resuelto. Usando fallback EO/EX.', { family, duty });
    const tmp = ctx.type === 'OEM' ? 'EO' : 'EX';
    return `${tmp}${core}`;
  }
  return `${prefix}${core}`;
}

module.exports = { generateSkuFrom, loadRules };
