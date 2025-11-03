// utils/normalizeQuery.js
// Normaliza consultas de códigos de filtro antes de buscar en la base o en la hoja Master

/**
 * Normaliza un número de parte o código de búsqueda eliminando espacios,
 * símbolos y formateando en mayúsculas para coincidencias consistentes.
 * @param {string} query - Valor de entrada del usuario (SKU, OEM, Cross, etc.)
 * @returns {string} - Query limpia y normalizada
 */
function normalizeQuery(query = '') {
  if (!query || typeof query !== 'string') return '';

  // Eliminar espacios, guiones, tabulaciones, puntos y caracteres especiales
  let clean = query
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]+/g, '') // elimina espacios y guiones
    .replace(/[^\w\d]/g, ''); // elimina cualquier símbolo raro

  // Normaliza errores comunes (letras "O" por ceros, etc.)
  clean = clean.replace(/O(?=\d)/g, '0'); // si hay una O antes de número, reemplaza por 0
  clean = clean.replace(/[^A-Z0-9]/g, '');

  // Elimina prefijos redundantes como "OEM" o "REF"
  clean = clean.replace(/^(OEM|REF)/, '');

  // Evita duplicar letras iniciales por error humano (ej: PP552712 → P552712)
  clean = clean.replace(/^([A-Z])\1+/, '$1');

  return clean;
}

module.exports = normalizeQuery;
