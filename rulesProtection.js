// rulesProtection.js — Protección de REGLAS_MAESTRAS.json
const fs = require('fs');
const path = require('path');

let _cache = null;
let _metaCache = null;
let _loadedAt = null;

function _loadRawRules() {
  if (_cache) return _cache;
  const rulesPath = path.resolve(__dirname, 'config', 'REGLAS_MAESTRAS.json');
  if (!fs.existsSync(rulesPath)) {
    throw new Error(`REGLAS_MAESTRAS.json no encontrado en: ${rulesPath}`);
  }
  const raw = fs.readFileSync(rulesPath, 'utf8');
  let json;
  try { json = JSON.parse(raw); }
  catch (e) { throw new Error(`REGLAS_MAESTRAS.json inválido: ${e.message}`); }

  if (typeof json !== 'object' || json === null) throw new Error('REGLAS_MAESTRAS.json: formato inválido');

  const { version, correction, rules, decisionTable } = json;
  if (!version) throw new Error('Falta "version" en REGLAS_MAESTRAS.json');
  if (!Array.isArray(rules)) throw new Error('"rules" debe ser un array');
  if (!Array.isArray(decisionTable)) throw new Error('"decisionTable" debe ser un array');

  _cache = json;
  _loadedAt = new Date();
  _metaCache = {
    version: String(version),
    correction: correction ? String(correction) : null,
    rules_count: rules.length,
    decision_table_count: decisionTable.length,
    loaded_at: _loadedAt.toISOString(),
    immutable: true,
  };
  return _cache;
}

function getRulesMetadata() {
  if (!_metaCache) _loadRawRules();
  return _metaCache;
}

function getRuleEngine() {
  const raw = _loadRawRules();
  const { decisionTable } = raw;

  function evaluate(input) {
    const matches = [];
    for (const row of decisionTable) {
      const { when, then } = row || {};
      if (!when || !then) continue;
      let ok = true;
      for (const [k, v] of Object.entries(when)) {
        const val = input[k];
        if (typeof v === 'number') { if (typeof val !== 'number' || val < v) { ok = false; break; } }
        else if (typeof v === 'string') { if (String(val || '').toUpperCase() !== v.toUpperCase()) { ok = false; break; } }
        else if (Array.isArray(v)) { const U = String(val || '').toUpperCase(); if (!v.map(x=>String(x).toUpperCase()).includes(U)) { ok = false; break; } }
        else if (typeof v === 'boolean') { if (Boolean(val) !== v) { ok = false; break; } }
      }
      if (ok) matches.push(then);
    }

    const result = { tags: [], score: 0, actions: [] };
    for (const m of matches) {
      if (m.tag && !result.tags.includes(m.tag)) result.tags.push(m.tag);
      if (typeof m.score === 'number') result.score += m.score;
      if (Array.isArray(m.actions)) result.actions.push(...m.actions);
    }
    return result;
  }

  return { evaluate };
}

function reloadRules() {
  _cache = null; _metaCache = null; _loadedAt = null;
  _loadRawRules();
  return getRulesMetadata();
}

module.exports = { getRulesMetadata, getRuleEngine, reloadRules };
