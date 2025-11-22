// utils.js - Utilidades generales para detectionService
// ============================================================================

/**
 * Normaliza un query para búsqueda
 * @param {string} query - Query a normalizar
 * @returns {string} Query normalizado
 */
function normalizeQuery(query) {
  if (!query || typeof query !== 'string') return '';
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s\-\/]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Genera una descripción por defecto
 * @param {string} sku - SKU del filtro
 * @param {string} filterType - Tipo de filtro
 * @param {string} duty - Nivel de duty
 * @returns {string} Descripción generada
 */
function generateDefaultDescription(sku, filterType, duty) {
  const dutyText = duty === 'HD' ? 'Heavy Duty' : duty === 'LD' ? 'Light Duty' : '';
  return `ELIMFILTERS ${sku} - ${filterType} ${dutyText}`.trim();
}

/**
 * Limpia un array removiendo valores vacíos o undefined
 * @param {Array|string} value - Valor a limpiar
 * @returns {Array} Array limpio
 */
function cleanArray(value) {
  if (!value) return [];
  
  // Si es un string, intentar parsear como JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        value = parsed;
      } else {
        // Si no es array después de parsear, convertir a array
        return [value].filter(v => v && v.trim() !== '');
      }
    } catch (e) {
      // Si falla el parse, tratar como string separado por comas
      value = value.split(',').map(v => v.trim()).filter(v => v !== '');
    }
  }
  
  // Si ya es un array, limpiarlo
  if (Array.isArray(value)) {
    return value.filter(v => v !== undefined && v !== null && v !== '');
  }
  
  return [];
}

/**
 * Limpia un objeto removiendo propiedades vacías
 * @param {Object} obj - Objeto a limpiar
 * @returns {Object} Objeto limpio
 */
function cleanObject(obj) {
  if (!obj || typeof obj !== 'object') return {};
  
  const cleaned = {};
  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

/**
 * Valida si un string es un código válido (no vacío y no genérico)
 * @param {string} code - Código a validar
 * @returns {boolean} True si es válido
 */
function isValidCode(code) {
  if (!code || typeof code !== 'string') return false;
  
  const normalized = code.trim().toUpperCase();
  
  // Rechazar códigos demasiado cortos o genéricos
  if (normalized.length < 3) return false;
  if (normalized === 'N/A' || normalized === 'NA' || normalized === 'UNKNOWN') return false;
  
  return true;
}

/**
 * Extrae dígitos de un string
 * @param {string} str - String del cual extraer dígitos
 * @returns {string} Solo los dígitos
 */
function extractDigits(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/\D/g, '');
}

/**
 * Capitaliza la primera letra de cada palabra
 * @param {string} str - String a capitalizar
 * @returns {string} String capitalizado
 */
function capitalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  normalizeQuery,
  generateDefaultDescription,
  cleanArray,
  cleanObject,
  isValidCode,
  extractDigits,
  capitalize
};
