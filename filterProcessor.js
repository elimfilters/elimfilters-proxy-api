// filterProcessor.js  — versión sin OpenAI

const { normalizeQuery } = require('./utils');
const dataAccess = require('./dataAccess');
const businessLogic = require('./businessLogic');
const jsonBuilder = require('./jsonBuilder');

/**
 * Procesa una consulta de filtro sin IA:
 * - Normaliza query
 * - Busca en Sheets / fuente de datos
 * - Aplica lógica de negocio y homologación
 * - Devuelve JSON estándar listo para front
 */
async function processFilterCode(rawQuery, opts = {}) {
  const q = normalizeQuery(String(rawQuery || '').trim());
  if (!q) {
    return jsonBuilder.buildError('EMPTY_QUERY', 'La consulta está vacía');
  }

  // 1) Buscar coincidencias crudas
  const records = await dataAccess.findByCodeOrCrossRef(q, opts);
  if (!records || records.length === 0) {
    return jsonBuilder.buildNotFound(q);
  }

  // 2) Aplicar lógica de negocio + homologación
  const enriched = businessLogic.enrich(records, { query: q });

  // 3) Armar respuesta estándar
  return jsonBuilder.buildSuccess({
    query: q,
    items: enriched.items,
    summary: enriched.summary,
    // agrega campos que tu front espera, ej. sku_estandar, oem_codes, etc.
  });
}

module.exports = { processFilterCode };
