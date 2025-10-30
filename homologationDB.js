// homologationDB.js — mapeo simple de SKU
// Ajusta aquí si tienes prefijos/familias.
function mapSku(input) {
  // Normalización básica: alfanumérico en mayúsculas
  const s = String(input || '').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  return s;
}

module.exports = { mapSku };
