const { normalizeQuery } = require('./utils');
let sheetsInstance = null;

function setSheetsInstance(s) { sheetsInstance = s; }

async function detect(raw) {
  const q = normalizeQuery(String(raw || '').trim());
  if (!q) return { query: '', normalized: '', ok: false, reason: 'EMPTY' };
  return { query: raw, normalized: q, ok: true, reason: 'OK', sheetsInstance };
}

module.exports = { setSheetsInstance, detect };
