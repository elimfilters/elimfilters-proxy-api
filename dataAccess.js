// dataAccess.js
// v3.0.0 – inserción idempotente al Master

const sheets = require('./googleSheetsConnectorInstance'); // ver server.js para seteo
const MASTER_RANGE = process.env.SHEET_RANGE || 'Master!A:Z';

function indexOf(colNames, name) {
  const i = colNames.indexOf(name);
  return i >= 0 ? i : null;
}

async function getAllRows() {
  const rows = await sheets.readRange(MASTER_RANGE);
  return rows;
}

async function existsByKeys({ SKU, OEM, CrossRef }) {
  const rows = await getAllRows();
  if (!rows.length) return false;
  const header = rows[0];
  const iSKU = indexOf(header, 'sku');
  const iOEM = indexOf(header, 'oem_codes');
  const iX  = indexOf(header, 'cross_ref');

  return rows.slice(1).some(r => {
    const skuMatch = iSKU!=null && SKU && r[iSKU] === SKU;
    const oemMatch = iOEM!=null && OEM && (String(r[iOEM]||'').split(',').map(x=>x.trim())).includes(OEM);
    const xrfMatch = iX!=null && CrossRef && (String(r[iX]||'').split(',').map(x=>x.trim())).includes(CrossRef);
    return skuMatch || oemMatch || xrfMatch;
  });
}

async function insertIfNew(payload) {
  if (await existsByKeys({
    SKU: payload.sku,
    OEM: payload.oem_codes,
    CrossRef: payload.cross_ref
  })) {
    return { inserted: false, reason: 'DUPLICATE' };
  }

  // Asegura cabecera
  const header = [
    'query_norm','sku','family','duty','oem_codes','cross_ref',
    'filter_type','media_type','subtype','engine_applications',
    'equipment_applications','height_mm','outer_diameter','thread_size','gasket'
  ];
  await sheets.ensureHeaders(MASTER_RANGE, header);

  const row = [[
    payload.query_norm || '',
    payload.sku || '',
    payload.family || '',
    payload.duty || '',
    payload.oem_codes || '',
    payload.cross_ref || '',
    payload.filter_type || '',
    payload.media_type || '',
    payload.subtype || '',
    payload.engine_applications || '',
    payload.equipment_applications || '',
    payload.height_mm || '',
    payload.outer_diameter || '',
    payload.thread_size || '',
    payload.gasket || ''
  ]];

  await sheets.appendRows(MASTER_RANGE, row);
  return { inserted: true };
}

module.exports = {
  existsByKeys,
  insertIfNew
};
