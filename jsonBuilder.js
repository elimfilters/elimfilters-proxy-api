function buildSuccess(payload) { return { ok: true, ...payload }; }
function buildNotFound(query) { return { ok: false, code: 'NOT_FOUND', query }; }
function buildError(code, message) { return { ok: false, code, message }; }
module.exports = { buildSuccess, buildNotFound, buildError };
