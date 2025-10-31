// utils.js — Validación estricta de SKU ELIMFILTERS (prefijo válido + 4 dígitos)
const { loadRules } = require('./homologationDB');

/** Normaliza consulta a A-Z0-9 en mayúsculas */
function normalizeQuery(s) {
  return String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** Lista de prefijos válidos desde las reglas (allPrefixes o decisionTable) */
function getValidPrefixes() {
  const rules = loadRules();
  // 1) Preferir allPrefixes si existe
  if (Array.isArray(rules.allPrefixes) && rules.allPrefixes.length) {
    return rules.allPrefixes.map(p => String(p).toUpperCase());
  }
  // 2) Derivar de decisionTable si no hay allPrefixes
  const dt = rules.decisionTable || {};
  const set = new Set(Object.values(dt).map(v => String(v).toUpperCase()));
  return Array.from(set);
}

/** SKU estricto: ^(?:<PREFIJO_VALIDO>)\d{4}$ */
function isStrictElimSku(code) {
  const c = normalizeQuery(code);
  const prefixes = getValidPrefixes();
  if (!prefixes.length) return false;
  const alt = prefixes.map(p => p.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
  const re = new RegExp(`^(?:${alt})\\d{4}$`, 'i');
  return re.test(c);
}

/** Alias histórico: ahora SKU estricto */
function isValidCode(code) {
  return isStrictElimSku(code);
}

module.exports = {
  normalizeQuery,
  getValidPrefixes,
  isStrictElimSku,
  isValidCode,
};
