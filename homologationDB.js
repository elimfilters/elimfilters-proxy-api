// homologationDB.js — CONCATENACIÓN LITERAL: prefix + core4 (sin colapsar)
const fs = require('fs');
const path = require('path');

const normalize = s => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const coreLast4 = src => normalize(src).slice(-4).padStart(4, '0');

let _RULES = null;
function loadRules() {
  if (_RULES) return _RULES;
  const candidates = [
    path.resolve(__dirname, 'REGLAS MAESTRAS'),
    path.resolve(__dirname, 'config', 'REGLAS_MAESTRAS.json'),
  ];
  let text = null, used = null;
  for (const p of candidates) if (fs.existsSync(p)) { text = fs.readFileSync(p, 'utf8'); used = p; break; }
  if (!text) throw new Error('REGLAS MAESTRAS no encontrado');
  try { _RULES = JSON.parse(text); } catch (e) { throw new Error(`REGLAS MAESTRAS inválido (${used}): ${e.message}`); }
  return _RULES;
}

function resolvePrefix(family, duty) {
  const dt = (loadRules().decisionTable || {});
  return dt[`${String(family||'').toUpperCase()}|${String(duty||'').toUpperCase()}`] || null;
}

// Concatenación estricta, sin trims ni replaces
function joinPrefixCore(prefix, core) {
  return `${prefix}${core}`;
}

function generateSkuFrom(sourceCode, ctx = {}) {
  const core = coreLast4(sourceCode);              // ej: 1R1808 → 1808
  const prefix = resolvePrefix(ctx.family, ctx.duty);
  if (!prefix) {
    console.warn('[SKU RULES] Prefijo no resuelto. Fallback EO/EX.', { family: ctx.family, duty: ctx.duty });
    return joinPrefixCore(ctx.type === 'OEM' ? 'EO' : 'EX', core);
  }
  // NUNCA colapsar dígitos; siempre prefix + core literal
  const sku = joinPrefixCore(prefix, core);
  return sku;
}

module.exports = { generateSkuFrom, loadRules };
