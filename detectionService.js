// detectionService.js
const normalizeQuery = require('./utils/normalizeQuery');
let sheetsInstance = null;

/**
 * Configura la instancia de Google Sheets
 */
function setSheetsInstance(instance) {
  sheetsInstance = instance;
  console.log('✅ Google Sheets instance configurada en detectionService');
}

/**
 * Detecta el filtro en base al query proporcionado
 */
async function detectFilter(query) {
  if (!sheetsInstance) {
    throw new Error('Google Sheets instance no inicializada');
  }

  const normalized = normalizeQuery(query);
  console.log(`🔍 Detectando filtro: ${normalized}`);

  try {
    const data = await sheetsInstance.findProduct(normalized);
    if (!data) {
      return {
        status: 'NOT_FOUND',
        message: 'Filtro no encontrado en la base de datos',
        query_norm: normalized,
      };
    }

    return {
      status: 'OK',
      source: 'Master',
      data: {
        query_norm: normalized,
        sku: data.SKU || '',
        family: data.Family || '',
        duty: data.Duty || '',
        oem_codes: data.OEM || '',
        cross_reference: data.CrossReference || '',
        filter_type: data.FilterType || '',
        media: data.Media || '',
        notes: data.Notes || '',
      },
    };
  } catch (error) {
    console.error('❌ Error en detectFilter:', error);
    return { status: 'ERROR', message: error.message };
  }
}

module.exports = {
  setSheetsInstance,
  detectFilter,
};
