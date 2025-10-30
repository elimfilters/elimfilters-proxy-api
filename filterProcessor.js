// filterProcessor.js — OEM/XREF crean; SKU solo si ya existe.
// Usa family/duty (si vienen en el body) para generar el SKU correcto según tus reglas.
const { normalizeQuery, isValidCode } = require('./utils');
const dataAccess = require('./dataAccess');
const businessLogic = require('./businessLogic');
const jsonBuilder = require('./jsonBuilder');
const { generateSkuFrom } = require('./homologationDB');

function _nowISO() { return new Date().toISOString(); }

// Detecta el tipo de código de entrada
function detectCodeType(code) {
  const c = String(code || '').toUpperCase();
  // Nota: SKU interno se valida con tus reglas via isValidCode()
  if (/^[0-9]{5,}$/.test(c)) return 'OEM'; // Solo números (>=5)
  if (isValidCode(c)) return 'SKU';        // Interno ELIMFILTERS
  return 'XREF';                           // Alfanumérico mixto → Cross Reference
}

/**
 * Proceso principal:
 *  - Busca en hoja: si existe, devuelve enriquecido.
 *  - Si NO existe:
 *      - SKU → NO crea, devuelve NOT_FOUND.
 *      - OEM/XREF → genera SKU según reglas (family/duty) y CREA una fila.
 *    La columna de destino recibirá el valor del tipo consultado (OEM o CrossRef),
 *    y el SKU generado se coloca en columna SKU.
 */
async function processFilterCode(rawQuery, opts = {}) {
  const q = normalizeQuery(String(rawQuery || '').trim());
  if (!q) return jsonBuilder.buildError('EMPTY_QUERY', 'La consulta está vacía');

  const codeType = detectCodeType(q);

  // 1) Buscar en la hoja
  const records = await dataAccess.findByCodeOrCrossRef(q, opts);
  if (records && records.length > 0) {
    const enriched = businessLogic.enrich(records, { query: q, codeType });
    return jsonBuilder.buildSuccess({
      query: q,
      codeType,
      items: enriched.items,
      summary: enriched.summary
    });
  }

  // 2) No existe en hoja
  //    - Si es SKU → no crear, responder NOT_FOUND
  if (codeType === 'SKU') {
    return jsonBuilder.buildNotFound(q);
  }

  //    - Si es OEM o XREF → generar SKU (usando family/duty si están en el body)
  const reqBody = opts.reqBody || {};
  const family = reqBody.family; // p.ej. "OIL", "FUEL", "AIRE", "TURBINE SERIES", etc.
  const duty   = reqBody.duty;   // "HD" | "LD"

  // Genera el SKU con tus reglas oficiales (homologationDB lee REGLAS MAESTRAS)
  const newSKU = generateSkuFrom(q, { type: codeType, family, duty });

  // Preparar fila nueva respetando los encabezados existentes
  const { headers } = await dataAccess.getTable(opts);

  // Determina columnas dinámicas
  const H = headers.map(h => String(h).trim().toUpperCase());
  const row = headers.map((h, idx) => {
    const HU = H[idx];

    if (HU === 'SKU' || HU === 'CODIGO' || HU === 'CODE') return newSKU;
    if (HU === 'OEM' || HU === 'CODIGO OEM') return (codeType === 'OEM') ? q : '';
    if (HU === 'CROSSREF' || HU === 'CROSS REF' || HU === 'EQUIVALENCIA' || HU === 'EQUIVALENTE') {
      return (codeType === 'XREF') ? q : '';
    }
    if (HU === 'FAMILY' || HU === 'FAMILIA') return family || '';
    if (HU === 'DUTY') return duty || '';
    if (HU === 'STATUS' || HU === 'ESTADO') return 'NEW';
    if (HU === 'CREATED_AT' || HU === 'FECHA') return _nowISO();
    if (HU === 'SOURCE' || HU === 'ORIGEN') return 'API';
    return '';
  });

  await dataAccess.appendRow(row, opts);

  // Devolver respuesta de creación
  const item = {
    SKU: newSKU,
    OEM: codeType === 'OEM' ? q : '',
    CrossRef: codeType === 'XREF' ? q : '',
    FAMILY: family || '',
    DUTY: duty || '',
    STATUS: 'NEW',
    CREATED_AT: _nowISO(),
    SOURCE: 'API'
  };

  return jsonBuilder.buildSuccess({
    created: true,
    query: q,
    codeType,
    items: [item],
    summary: { count: 1, created: 1 }
  });
}

module.exports = { processFilterCode };
