// homologationDB.js — genera SKU propio a partir de códigos OEM o CrossRef
function normalize(s) {
  return String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Genera SKU basado en un código de origen.
 * - OEM → prefijo EO
 * - XREF → prefijo EX
 * - Se trunca si excede 18 caracteres
 */
function generateSkuFrom(sourceCode, ctx = {}) {
  const src = normalize(sourceCode);
  const prefix = ctx.type === 'OEM' ? 'EO' : 'EX';
  const core = src.slice(0, 18);
  return `${prefix}${core}`;
}

module.exports = { generateSkuFrom };
