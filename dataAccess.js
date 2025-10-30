// dataAccess.js — lectura y escritura
function _sheetNameFromRange(range) {
  const m = String(range).match(/^'?([^'!]+)'?!/);
  return m ? m[1] : 'Master';
}

async function getTable(opts = {}) {
  const { sheetsInstance } = opts;
  if (!sheetsInstance || !sheetsInstance.sheets) {
    throw new Error('SHEETS_NOT_INITIALIZED');
  }
  const range = process.env.SHEET_RANGE || 'Master!A:Z';

  let data;
  try {
    const resp = await sheetsInstance.sheets.spreadsheets.values.get({
      spreadsheetId: sheetsInstance.sheetId,
      range
    });
    data = resp.data;
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('Unable to parse range')) throw new Error(`BAD_RANGE:${range}`);
    if (msg.includes('The caller does not have permission')) throw new Error('SHEETS_PERMISSION_DENIED');
    throw e;
  }

  const rows = data.values || [];
  const headers = rows[0] || [];
  const list = rows.slice(1).map(r => Object.fromEntries(headers.map((h,i)=>[h, r[i] ?? ''])));
  return { headers, list, range };
}

async function appendRow(values, opts = {}) {
  const { sheetsInstance } = opts;
  if (!sheetsInstance || !sheetsInstance.sheets) {
    throw new Error('SHEETS_NOT_INITIALIZED');
  }
  const baseRange = process.env.SHEET_RANGE || 'Master!A:Z';
  const sheetName = _sheetNameFromRange(baseRange);

  return await sheetsInstance.sheets.spreadsheets.values.append({
    spreadsheetId: sheetsInstance.sheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] }
  });
}

async function findByCodeOrCrossRef(code, opts = {}) {
  const { headers, list } = await getTable(opts);
  const key = String(code || '').toUpperCase();

  // Detecta nombres de columna flexibles
  const mapHeader = (regexArr) =>
    headers.find(h => regexArr.some(rx => rx.test(h))) || null;

  const hSKU = mapHeader([/^sku$/i, /^codigo$/i, /^code$/i]);
  const hOEM = mapHeader([/^oem$/i, /^codigo\s*oem$/i]);
  const hXRF = mapHeader([/^cross\s*ref$/i, /^crossref$/i, /^equivalencia$/i, /^equivalente$/i]);

  const hits = list.filter(row => {
    const vSKU = String(hSKU ? row[hSKU] : '').toUpperCase();
    const vOEM = String(hOEM ? row[hOEM] : '').toUpperCase();
    const vXRF = String(hXRF ? row[hXRF] : '').toUpperCase();
    return vSKU === key || vOEM.includes(key) || vXRF.includes(key);
  });

  return hits;
}

module.exports = { getTable, appendRow, findByCodeOrCrossRef };
