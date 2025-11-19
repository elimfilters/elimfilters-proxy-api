// ============================================================================
// ELIMFILTERS — JSON BUILDER v3.0
// Respuestas estandarizadas para el Master Sheet y para el cliente
// ============================================================================

function buildStandardResponse(data) {
  return {
    found: true,
    ok: true,
    ...data
  };
}

function buildErrorResponse(error) {
  return {
    found: false,
    ok: false,
    ...error
  };
}

// Rellena columnas faltantes para que la hoja NUNCA rompa
function padToMasterColumns(data, headers) {
  const padded = { ...data };
  headers.forEach(h => {
    if (!(h in padded)) padded[h] = "";
  });
  return padded;
}

module.exports = {
  buildStandardResponse,
  buildErrorResponse,
  padToMasterColumns
};
