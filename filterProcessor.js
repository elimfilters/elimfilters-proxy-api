// filterProcessor.js — OEM y XREF crean; SKU solo si ya existe
const { normalizeQuery, isValidCode } = require('./utils');
const dataAccess = require('./dataAccess');
const businessLogic = require('./businessLogic');
const jsonBuilder = require('./jsonBuilder');
const { generateSkuFrom } = require('./homologationDB');

function _nowISO(){ return new Date().toISOString(); }

// Detectar tipo de código
function detectCodeType(code) {
  const c = String(code || '').toUpperCase();
  if (isValidCode(c)) return 'SKU';       // Interno ELIMFILTERS
  if (/^[0-9]{5,}$/.test(c)) return 'OEM'; // Solo números
  return 'XREF';                          // Alfanumérico mixto
}

async function processFilterCode(rawQuery, opts = {}) {
  const q = normalizeQuery(rawQuery);
  if (!q) return jsonBuilder.buildError('EMPTY_QUERY', 'La consulta está vacía');

  const codeType = detectCodeType(q);

  // 1) Buscar si existe
  const records = await dataAccess.findByCodeOrCrossRef(q, opts);
  if (records && records.length > 0) {
    const enriched = businessLogic.enrich(records, { query: q });
    return jsonBuilder.buildSuccess({
      query: q,
      codeType,
      items: enriched.items,
      summary: enriched.summary
    });
  }

  // 2) No existe
  //    - Si es SKU → no crear, solo devolver NOT_FOUND
  if (codeType === 'SKU') {
    return jsonBuilder.buildNotFound(q);
  }

  //    - Si es OEM o XREF → generar SKU y crear fila
  const { headers } = await dataAccess.getTable(opts);
  const newSKU = generateSkuFrom(q, { type: codeType });
  const newOEM = codeType === 'OEM' ? q : '';
  const newXRF = codeType === 'XREF' ? q : '';

  const row = headers.map(h => {
    const H = String(h).trim().toUpperCase();
    if (H === 'SKU' || H === 'CODIGO' || H === 'CODE') return newSKU;
    if (H === 'OEM' || H === 'CODIGO OEM') return newOEM;
    if (H === 'CROSSREF' || H === 'CROSS REF' || H === 'EQUIVALENCIA' || H === 'EQUIVALENTE') return newXRF;
    if (H === 'STATUS' || H === 'ESTADO') return 'NEW';
    if (H === 'CREATED_AT' || H === 'FECHA') return _nowISO();
    if (H === 'SOURCE' || H === 'ORIGEN') return 'API';
    return '';
  });

  await dataAccess.appendRow(row, opts);

  return jsonBuilder.buildSuccess({
    created: true,
    query: q,
    codeType,
    items: [{ SKU: newSKU, OEM: newOEM, CrossRef: newXRF, STATUS: 'NEW', CREATED_AT: _nowISO(), SOURCE: 'API' }],
    summary: { count: 1, created: 1 }
  });
}

module.exports = { processFilterCode };
