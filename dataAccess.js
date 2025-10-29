async function findByCodeOrCrossRef(code, opts = {}) {
  const { sheetsInstance } = opts;
  if (!sheetsInstance || !sheetsInstance.sheets) throw new Error('Sheets no inicializado');

  const range = process.env.SHEET_RANGE || 'Catalog!A:Z';
  const { data } = await sheetsInstance.sheets.spreadsheets.values.get({
    spreadsheetId: sheetsInstance.sheetId,
    range
  });

  const rows = data.values || [];
  // Asume primera fila headers
  const headers = rows[0] || [];
  const list = rows.slice(1).map(r => Object.fromEntries(headers.map((h,i)=>[h, r[i] || ''])));

  const key = code.toUpperCase();
  const hits = list.filter(x =>
    String(x.SKU || '').toUpperCase() === key ||
    String(x.OEM || '').toUpperCase().includes(key) ||
    String(x.CrossRef || '').toUpperCase().includes(key)
  );

  return hits;
}

module.exports = { findByCodeOrCrossRef };
