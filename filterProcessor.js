// filterProcessor.js — crea fila si no existe
const { normalizeQuery } = require('./utils');
const dataAccess = require('./dataAccess');
const businessLogic = require('./businessLogic');
const jsonBuilder = require('./jsonBuilder');
const { mapSku } = require('./homologationDB');

function _nowISO(){ return new Date().toISOString(); }

async function processFilterCode(rawQuery, opts = {}) {
  const q = normalizeQuery(String(rawQuery || '').trim());
  if (!q) return jsonBuilder.buildError('EMPTY_QUERY', 'La consulta está vacía');

  // 1) Buscar
  const records = await dataAccess.findByCodeOrCrossRef(q, opts);
  if (records && records.length > 0) {
    const enriched = businessLogic.enrich(records, { query: q });
    return jsonBuilder.buildSuccess({
      query: q,
      items: enriched.items,
      summary: enriched.summary
    });
  }

  // 2) No encontrado → crear
  const sku = mapSku(q);

  // Leemos headers para construir la fila respetando el orden
  const { headers } = await dataAccess.getTable(opts);

  const row = headers.map(h => {
    const H = String(h).trim().toUpperCase();
    if (H === 'SKU' || H === 'CODIGO' || H === 'CODE') return sku;
    if (H === 'OEM' || H === 'CODIGO OEM') return '';
    if (H === 'CROSSREF' || H === 'CROSS REF' || H === 'EQUIVALENCIA' || H === 'EQUIVALENTE') return q;
    if (H === 'STATUS' || H === 'ESTADO') return 'NEW';
    if (H === 'CREATED_AT' || H === 'FECHA') return _nowISO();
    if (H === 'SOURCE' || H === 'ORIGEN') return 'API';
    return '';
  });

  await dataAccess.appendRow(row, opts);

  // 3) Devolver creación mínima
  return jsonBuilder.buildSuccess({
    created: true,
    query: q,
    items: [{ SKU: sku, OEM: '', CrossRef: q, STATUS: 'NEW', CREATED_AT: _nowISO(), SOURCE: 'API' }],
    summary: { count: 1, created: 1 }
  });
}

module.exports = { processFilterCode };
