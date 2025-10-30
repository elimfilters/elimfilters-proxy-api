// filterProcessor.js — versión sin OpenAI
const { normalizeQuery } = require('./utils');
const dataAccess = require('./dataAccess');
const businessLogic = require('./businessLogic');
const jsonBuilder = require('./jsonBuilder');

async function processFilterCode(rawQuery, opts = {}) {
  const q = normalizeQuery(String(rawQuery || '').trim());
  if (!q) return jsonBuilder.buildError('EMPTY_QUERY', 'La consulta está vacía');

  const records = await dataAccess.findByCodeOrCrossRef(q, opts);
  if (!records || records.length === 0) {
    return jsonBuilder.buildNotFound(q);
  }

  const enriched = businessLogic.enrich(records, { query: q });
  return jsonBuilder.buildSuccess({
    query: q,
    items: enriched.items,
    summary: enriched.summary,
  });
}

module.exports = { processFilterCode };
