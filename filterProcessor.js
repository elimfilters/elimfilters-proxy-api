// filterProcessor.js
// v3.0.0 – usa detectionService + businessLogic; inserta y audita en Sheets solo para OEM/XREF

const detectionService = require('./detectionService');
const businessLogic = require('./businessLogic');
const dataAccess = require('./dataAccess');
const sheets = require('./googleSheetsConnectorInstance');

function normalize(q) {
  return String(q || '').trim();
}

function isValidSKUFormat(s) {
  // Prefijos oficiales + 4 dígitos estrictos
  const re = /^(EL8|EF9|EA1|EC1|ES9|ED4|EH6|EW7|EA2|ET9|EK5|EK3)\d{4}$/i;
  return re.test(s);
}

async function processQuery(input) {
  const query = normalize(input.query);
  if (!query) return { ok: false, code: 'EMPTY_QUERY' };

  // Detecta tipo (SKU/OEM/XREF) y familia/duty segun reglas existentes
  const detected = await detectionService.detect({ query, family: input.family, duty: input.duty });
  // detected: { codeType: 'SKU'|'OEM'|'XREF'|'INVALID', family, duty, normalized }

  if (detected.codeType === 'SKU') {
    // SKU: nunca crea filas; validar formato
    if (!isValidSKUFormat(detected.normalized)) {
      return { ok: false, code: 'INVALID_SKU_FORMAT', query };
    }
    const enrich = await businessLogic.lookupBySKU(detected.normalized);
    if (!enrich) return { ok: false, code: 'NOT_FOUND', query };
    return { ok: true, created: false, codeType: 'SKU', items: [enrich] };
  }

  if (detected.codeType === 'INVALID') {
    return { ok: false, code: 'NOT_FOUND', query };
  }

  // OEM o XREF → genera SKU por reglas, aplica familia/duty, crea fila si no existe
  const generated = await businessLogic.generateFromCode({
    codeType: detected.codeType,
    code: detected.normalized,
    family: detected.family,
    duty: detected.duty
  });
  // generated: { SKU, FAMILY, DUTY, OEM?, CrossRef? }

  if (!generated || !generated.SKU) {
    return { ok: false, code: 'GENERATION_FAILED', query };
  }

  // Inserción idempotente al Master
  const ins = await dataAccess.insertIfNew({
    query_norm: query,
    sku: generated.SKU,
    family: generated.FAMILY || '',
    duty: generated.DUTY || '',
    oem_codes: generated.OEM || (detected.codeType === 'OEM' ? detected.normalized : ''),
    cross_ref: generated.CrossRef || (detected.codeType === 'XREF' ? detected.normalized : ''),
    filter_type: '',
    media_type: '',
    subtype: '',
    engine_applications: '',
    equipment_applications: '',
    height_mm: '',
    outer_diameter: '',
    thread_size: '',
    gasket: ''
  });

  // Auditoría
  await sheets.appendAudit({
    event: ins.inserted ? 'CREATE' : 'SKIP_DUP',
    query,
    codeType: detected.codeType,
    ...generated,
    STATUS: ins.inserted ? 'NEW' : 'DUP',
    SOURCE: 'API'
  });

  return {
    ok: true,
    created: !!ins.inserted,
    codeType: detected.codeType,
    items: [{
      ...generated,
      STATUS: ins.inserted ? 'NEW' : 'EXISTS',
      CREATED_AT: new Date().toISOString(),
      SOURCE: 'API'
    }],
    summary: { count: 1, created: ins.inserted ? 1 : 0 }
  };
}

module.exports = { processQuery };
