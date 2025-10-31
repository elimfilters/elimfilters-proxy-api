// filterProcessor.js — v3.0.0
// Reglas: OEM/XREF crean filas; SKU solo si existe. Prefijos SIEMPRE desde decisionTable.
// Core numérico (4 dígitos) se calcula en homologationDB. Aquí NO se toca el SKU.

const { normalizeQuery, isValidCode } = require('./utils');
const dataAccess = require('./dataAccess');
const businessLogic = require('./businessLogic');
const jsonBuilder = require('./jsonBuilder');
const { generateSkuFrom, loadRules } = require('./homologationDB');

function nowISO() { return new Date().toISOString(); }

// Detecta tipo del código de entrada
function detectCodeType(code) {
  const c = String(code || '').toUpperCase();
  if (/^[0-9]{5,}$/.test(c)) return 'OEM'; // solo dígitos (>=5) → OEM
  if (isValidCode(c)) return 'SKU';        // interno ELIMFILTERS
  return 'XREF';                           // mixto → Cross Reference
}

/**
 * Proceso principal:
 * 1) Busca en la hoja. Si existe, devuelve enriquecido.
 * 2) Si NO existe:
 *    - SKU → NO crea (NOT_FOUND).
 *    - OEM/XREF → requiere {family,duty} válidos en decisionTable; genera SKU y crea fila.
 */
async function processFilterCode(rawQuery, opts = {}) {
  const q = normalizeQuery(String(rawQuery || '').trim());
  if (!q) return jsonBuilder.buildError('EMPTY_QUERY', 'La consulta está vacía');

  const codeType = detectCodeType(q);

  // 1) Buscar en hoja
  const found = await dataAccess.findByCodeOrCrossRef(q, opts);
  if (found && found.length > 0) {
    const enriched = businessLogic.enrich(found, { query: q, codeType });
    return jsonBuilder.buildSuccess({
      query: q,
      codeType,
      items: enriched.items,
      summary: enriched.summary,
    });
  }

  // 2) No existe en hoja
  if (codeType === 'SKU') {
    // SKU NO crea filas si no existe
    return jsonBuilder.buildNotFound(q);
  }

  // OEM/XREF: exigir family/duty y validar en decisionTable
  const reqBody = opts.reqBody || {};
  const family = reqBody.family;
  const duty = reqBody.duty;

  if (!family || !duty) {
    return jsonBuilder.buildError(
      'MISSING_FAMILY_DUTY',
      'Para crear OEM/XREF debes enviar { family, duty } (ej. {"family":"AIRE","duty":"LD"}).'
    );
  }

  const rules = loadRules();
  const dt = rules.decisionTable || {};
  const key = `${String(family).toUpperCase()}|${String(duty).toUpperCase()}`;
  const prefix = dt[key];

  if (!prefix) {
    return jsonBuilder.buildError(
      'DECISION_KEY_NOT_FOUND',
      `No existe mapeo en decisionTable para "${key}".`
    );
  }

  // Generar SKU exacto según tus reglas (sin tocarlo después)
  let newSKU;
  try {
    newSKU = generateSkuFrom(q, { type: codeType, family, duty });
    console.log('[SKU RULES] key=%s -> prefix=%s | query=%s | SKU=%s', key, prefix, q, newSKU);
  } catch (e) {
    console.error('[SKU RULES][ERROR] %s', e?.message || e);
    return jsonBuilder.buildError('SKU_RULES_FAILED', 'Error generando el SKU con las reglas.');
  }

  // Preparar fila nueva respetando encabezados existentes
  const { headers } = await dataAccess.getTable(opts);
  const H = headers.map(h => String(h).trim().toUpperCase());

  const row = headers.map((h, idx) => {
    const HU = H[idx];

    if (HU === 'SKU' || HU === 'CODIGO' || HU === 'CODE') return newSKU; // NO normalizar
    if (HU === 'OEM' || HU === 'CODIGO OEM') return (codeType === 'OEM') ? q : '';
    if (HU === 'CROSSREF' || HU === 'CROSS REF' || HU === 'EQUIVALENCIA' || HU === 'EQUIVALENTE') {
      return (codeType === 'XREF') ? q : '';
    }
    if (HU === 'FAMILY' || HU === 'FAMILIA') return family || '';
    if (HU === 'DUTY') return duty || '';
    if (HU === 'STATUS' || HU === 'ESTADO') return 'NEW';
    if (HU === 'CREATED_AT' || HU === 'FECHA') return nowISO();
    if (HU === 'SOURCE' || HU === 'ORIGEN') return 'API';

    // Dejar vacío para columnas no mapeadas
    return '';
  });

  // Escribir y responder
  try {
    await dataAccess.appendRow(row, opts);

    const item = {
      SKU: newSKU,
      OEM: codeType === 'OEM' ? q : '',
      CrossRef: codeType === 'XREF' ? q : '',
      FAMILY: family || '',
      DUTY: duty || '',
      STATUS: 'NEW',
      CREATED_AT: nowISO(),
      SOURCE: 'API',
    };

    return jsonBuilder.buildSuccess({
      created: true,
      query: q,
      codeType,
      items: [item],
      summary: { count: 1, created: 1 },
    });
  } catch (e) {
    console.error('[SHEETS][APPEND][ERROR] %s', e?.message || e);

    const item = {
      SKU: newSKU,
      OEM: codeType === 'OEM' ? q : '',
      CrossRef: codeType === 'XREF' ? q : '',
      FAMILY: family || '',
      DUTY: duty || '',
      STATUS: 'PENDING_WRITE',
      CREATED_AT: nowISO(),
      SOURCE: 'API',
    };

    // No devolvemos 500; retornamos el SKU calculado y avisamos que no se pudo escribir.
    return {
      ok: true,
      created: false,
      warning: 'WRITE_FAILED',
      query: q,
      codeType,
      items: [item],
      summary: { count: 1, created: 0 },
    };
  }
}

module.exports = { processFilterCode, detectCodeType };
