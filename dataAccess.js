// dataAccess.js
// Capa de acceso a datos - conecta con Google Sheets
// v3.0.0

const detectionService = require('./detectionService');

/**
 * Query the master database (Google Sheets)
 * @param {string} normalizedCode - Código OEM normalizado
 * @returns {Promise<Object|null>} Registro encontrado o null
 */
async function queryMasterDatabase(normalizedCode) {
  try {
    // Usar detectionService para buscar en Google Sheets
    const result = await detectionService.lookupInSheets(normalizedCode);
    
    if (!result || !result.found) {
      return null;
    }

    // Retornar datos estructurados
    return {
      sku: result.sku || null,
      oem_code: result.oem_code || normalizedCode,
      family: result.family || null,
      duty_level: result.duty || result.duty_level || null,
      specs: result.specs || {},
      cross_reference: result.cross_reference || [],
      found: true,
      source: 'google_sheets'
    };

  } catch (error) {
    console.error('[DATA ACCESS] Error querying master database:', error.message);
    throw error;
  }
}

/**
 * Search multiple codes in master database
 * @param {Array<string>} codes - Lista de códigos a buscar
 * @returns {Promise<Array>} Resultados encontrados
 */
async function searchMultipleCodes(codes) {
  try {
    const results = [];
    
    for (const code of codes) {
      const result = await queryMasterDatabase(code);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  } catch (error) {
    console.error('[DATA ACCESS] Error searching multiple codes:', error.message);
    throw error;
  }
}

/**
 * Validate if code exists in database
 * @param {string} code - Código a validar
 * @returns {Promise<boolean>} true si existe
 */
async function codeExists(code) {
  try {
    const result = await queryMasterDatabase(code);
    return result !== null;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// EXPORTACIONES
// ============================================================================

module.exports = {
  queryMasterDatabase,
  searchMultipleCodes,
  codeExists
};
