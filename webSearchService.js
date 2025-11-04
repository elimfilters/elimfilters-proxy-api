// webSearchService.js v1.0.0 — Búsqueda web de equivalencias
const axios = require('axios');

/**
 * Busca equivalencia Donaldson/FRAM usando web search
 * @param {string} oemNumber - Número OEM a buscar
 * @param {string} duty - 'HD' o 'LD'
 * @param {string} family - Familia del filtro
 * @returns {object|null} - {brand, partNumber} o null
 */
async function searchCrossReference(oemNumber, duty, family, webSearchFunction) {
  try {
    const targetBrand = duty === 'HD' ? 'Donaldson' : 'FRAM';
    const query = `${oemNumber} ${targetBrand} equivalent cross reference filter`;
    
    console.log(`🔍 Buscando en web: ${query}`);
    
    // Llamar a la función web_search (pasada como parámetro)
    const searchResults = await webSearchFunction(query);
    
    if (!searchResults) {
      console.log('⚠️ No se obtuvieron resultados de búsqueda web');
      return null;
    }
    
    // Extraer equivalencia de los resultados
    const equivalence = extractEquivalence(searchResults, targetBrand, duty, family);
    
    if (equivalence) {
      console.log(`✅ Equivalencia encontrada vía web: ${equivalence.brand} ${equivalence.partNumber}`);
    } else {
      console.log(`⚠️ No se pudo extraer equivalencia de los resultados web`);
    }
    
    return equivalence;
  } catch (error) {
    console.error('❌ Error en búsqueda web:', error.message);
    return null;
  }
}

/**
 * Extrae número de parte Donaldson o FRAM de los resultados de búsqueda
 */
function extractEquivalence(searchResults, targetBrand, duty, family) {
  const text = searchResults.toLowerCase();
  
  if (duty === 'HD') {
    // Buscar patrones Donaldson: P + 6 dígitos
    const donaldsonPatterns = [
      /donaldson[:\s]+p(\d{6})/i,
      /p(\d{6})[,\s]+donaldson/i,
      /\bp(\d{6})\b/i,
    ];
    
    for (const pattern of donaldsonPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const partNumber = 'P' + match[1];
        // Validar que sea razonable
        if (isValidDonaldson(partNumber)) {
          return {
            brand: 'DONALDSON',
            partNumber: partNumber.toUpperCase(),
            family: family
          };
        }
      }
    }
  } else if (duty === 'LD') {
    // Buscar patrones FRAM
    const framPatterns = [
      /fram[:\s]+(ph|ca|cs|cf|ch|bg|g)(\d{4,})/i,
      /(ph|ca|cs|cf|ch|bg|g)(\d{4,})[,\s]+fram/i,
      /\b(ph|ca|cs|cf|ch|bg|g)(\d{4,})\b/i,
    ];
    
    for (const pattern of framPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[2]) {
        const partNumber = match[1].toUpperCase() + match[2];
        // Validar que sea razonable
        if (isValidFRAM(partNumber)) {
          return {
            brand: 'FRAM',
            partNumber: partNumber,
            family: family
          };
        }
      }
    }
  }
  
  return null;
}

/**
 * Valida si un número Donaldson es válido
 */
function isValidDonaldson(partNumber) {
  // P seguido de exactamente 6 dígitos
  return /^P\d{6}$/.test(partNumber);
}

/**
 * Valida si un número FRAM es válido
 */
function isValidFRAM(partNumber) {
  // Prefijos conocidos + 4-6 dígitos
  return /^(PH|CA|CS|CF|CH|BG|G)\d{4,6}$/.test(partNumber);
}

module.exports = { searchCrossReference };
