function normalizeQuery(s) {
  return s.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
}
module.exports = { normalizeQuery };
