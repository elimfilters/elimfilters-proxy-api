function normalizeQuery(s) {
  return String(s || '').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
}

/**
 * Valida SKU interno según reglas:
 *  - Prefijos permitidos por env ALLOWED_PREFIXES (coma-separados), ej: "EA,E,EF,PH"
 *  - Longitud mínima/máxima por env MIN_CODE_LEN / MAX_CODE_LEN
 */
function isValidCode(code) {
  const c = normalizeQuery(code);
  const min = Number(process.env.MIN_CODE_LEN || 3);
  const max = Number(process.env.MAX_CODE_LEN || 18);
  if (c.length < min || c.length > max) return false;

  const prefs = (process.env.ALLOWED_PREFIXES || 'EA,E,EF,PH')
    .split(',').map(x => x.trim().toUpperCase()).filter(Boolean);
  if (prefs.length === 0) return true;

  return prefs.some(p => c.startsWith(p));
}

module.exports = { normalizeQuery, isValidCode };
