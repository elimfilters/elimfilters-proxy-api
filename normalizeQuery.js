// utils/normalizeQuery.js
module.exports = function normalizeQuery(query) {
  if (!query || typeof query !== 'string') return '';
  return query.trim().toUpperCase().replace(/\s+/g, '');
};
