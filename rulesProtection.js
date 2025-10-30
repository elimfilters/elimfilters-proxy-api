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

  if (typeof json !== 'object' || json === null) {
    throw new Error('REGLAS_MAESTRAS.json: formato inválido');
  }

  const { version, correction, rules, decisionTable } = json;
  if (!version) throw new Error('Falta "version"');
  if (!
