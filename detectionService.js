const normalizeQuery = require('./utils/normalizeQuery');

let sheetsInstance = null;
function setSheetsInstance(instance) {
  sheetsInstance = instance;
}

async function detectFilter(query) {
  if (!query) return { status: 'error', message: 'Query vacía' };
  const normalized = normalizeQuery(query);
  const data = await sheetsInstance.searchFilter(normalized);

  return {
    status: 'OK',
    source: 'Master',
    data: data || {},
  };
}

module.exports = { setSheetsInstance, detectFilter };
