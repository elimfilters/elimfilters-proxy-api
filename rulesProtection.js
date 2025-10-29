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
    throw new Error(`REGLAS_MAESTRAS.json i_
