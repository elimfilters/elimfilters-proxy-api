// rulesProtection.js — Protección de REGLAS_MAESTRAS.json
// =======================================================

const fs = require('fs');
const path = require('path');

let _cache = null;        // cache interno del archivo de reglas
let _metaCache = null;    // cache de metadatos derivados
let _loadedAt = null;

function _loadRawRules() {
  if (_cache) return _cache;

  const rulesPath = path.resolve(__dirname, 'config', 'REGLAS_MAESTRAS.json');
  if (!fs.existsSync(rulesPath)) {
    throw new Error(`REGLAS_MAESTRAS.json no encontrado en: ${rulesPath}`);
  }

  const raw = fs.readFileSync(rulesPath, 'utf8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(`REGLAS_MAESTRAS.json inválido: ${e.message}`);
  }

  // Validaciones mínimas de esquema esperado
  if (typeof json !== 'object' || json === null) {
    throw new Error('REGLAS_MAESTRAS.json: formato inválido');
  }

  // Campos típicos esperados (ajusta a tu JSON real)
  const {
    version,
    correction,
    rules,
    decisionTable,
  } = json;

  if (!version) throw new Error('Falta "version" en REGLAS_MAESTRAS.json');
  if (!Array.isArray(rules)) throw new Error('"rules" debe ser un array');
  if (!Array.isArray(decisionTable))
    throw new Error('"decisionTable" debe ser un array');

  _cache = json;
  _loadedAt = new Date();
  _metaCache = {
    version: String(version),
    correction: correction ? String(correction) : null,
    rules_count: rules.length,
    decision_table_count: decisionTable.length,
    loaded_at: _loadedAt.toISOString(),
    immutable: true, // archivo embebido, sin lectura externa por HTTP
  };

  return _cache;
}

/**
 * Devuelve SOLO metadatos, nunca el contenido de reglas.
 * Úsalo en /api/rules para auditoría interna.
 */
function getRulesMetadata() {
  if (!_metaCache) _loadRawRules();
  return _metaCache;
}

/**
 * Devuelve un "motor" de reglas encapsulado y seguro.
 * Solo expone una API mínima para evaluar decisiones,
 * nunca expone el JSON completo.
 */
function getRuleEngine() {
  const raw = _loadRawRules();
  const { rules, decisionTable } = raw;

  /**
   * Evalúa una entrada contra la tabla de decisión.
   * @param {object} input  — datos de entrada normalizados
   * @returns {object}      — resultado con tags/acciones aplicadas
   */
  function evaluate(input) {
    // Implementación mínima de ejemplo: recorre decisionTable,
    // empareja condiciones y construye un resultado.
    // Ajusta a tu lógica real.
    const matches = [];

    for (const row of decisionTable) {
      // Ejemplo de fila:
      // { when: { family: 'AIR', sizeMin: 50 }, then: { tag: 'HD', score: 2 } }
      const { when, then } = row || {};
      if (!when || !then) continue;

      let ok = true;
      for (const [k, v] of Object.entries(when)) {
        // Comparaciones básicas
        if (typeof v === 'number') {
          if (typeof input[k] !== 'number' || input[k] < v) { ok = false; break; }
        } else if (typeof v === 'string') {
          if (String(input[k] || '').toUpperCase() !== v.toUpperCase()) { ok = false; break; }
        } else if (Array.isArray(v)) {
          const val = String(input[k] || '').toUpperCase();
          if (!v.map(x => String(x).toUpperCase()).includes(val)) { ok = false; break; }
        } else if (typeof v === 'boolean') {
          if (Boolean(input[k]) !== v) { ok = false; break; }
        }
      }
      if (ok) matches.push(then);
    }

    // Resolver resultado final simple
    // Puedes combinar scores, tags, flags, etc.
    const result = {
      tags: [],
      score: 0,
      actions: [],
    };

    for (const m of matches) {
      if (m.tag && !result.tags.includes(m.tag)) result.tags.push(m.tag);
      if (typeof m.score === 'number') result.score += m.score;
      if (Array.isArray(m.actions)) result.actions.push(...m.actions);
    }

    return result;
  }

  return { evaluate };
}

/**
 * Utilidad: recarga reglas en caliente si fuese necesario.
 * No expongas esta función en endpoints públicos.
 */
function reloadRules() {
  _cache = null;
  _metaCache = null;
  _loadedAt = null;
  _loadRawRules();
  return getRulesMetadata();
}

module.exports = {
  getRulesMetadata,
  getRuleEngine,
  reloadRules,
};
