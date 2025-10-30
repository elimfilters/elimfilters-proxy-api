// dataAccess.js — obtiene y agrega filas en la hoja Google
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

  const resp = await sheetsInstance.sheets.spreadsheets.values.get({
    spreadsheetId: sheetsInstance.sheetId,
    range
  });

  const rows = resp.data.values || [];
  const headers = rows[0] || [];
  const list = rows.slice(1).map(r =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? '']))
  );

  return { headers, list, range };
}

async function appendRow(values, opts = {}) {
  const { sheetsInstance } = opts;
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

  // detecta nombres de columna equivalentes
  const matchCol = (regexList) =>
    headers.find(h => regexList.some(rx => rx.test(h))) || null;

  const hSKU = matchCol([/^sku$/i, /^codigo$/i, /^code$/i]);
  const hOEM = matchCol([/^oem$/i, /^codigo\s*oem$/i]);
  const hXRF = matchCol([/^cross\s*ref$/i, /^crossref$/i, /^equivalente$/i, /^equivalencia$/i]);

  return list.filter(row => {
    const vSKU = String(hSKU ? row[hSKU] : '').toUpperCase();
    const vOEM = String(hOEM ? row[hOEM] : '').toUpperCase();
    const vXRF = String(hXRF ? row[hXRF] : '').toUpperCase();
    return vSKU === key || vOEM.includes(key) || vXRF.includes(key);
  });
}

module.exports = { getTable, appendRow, findByCodeOrCrossRef };
