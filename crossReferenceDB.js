// crossReferenceDB.js v1.0.0 — Base de datos de equivalencias
const CROSS_REFERENCE_DB = {
  // CATERPILLAR
  '1R1808': { donaldson: 'P551808', fram: null, family: 'OIL' },
  '1R0750': { donaldson: 'P550596', fram: 'PH8170', family: 'OIL' },
  '1R0739': { donaldson: 'P551329', fram: 'CS8941', family: 'FUEL' },
  '1R0716': { donaldson: 'P181050', fram: 'CA8755', family: 'AIR' },
  
  // KOMATSU
  '6001854100': { donaldson: 'P181050', fram: null, family: 'AIR' },
  '6003115020': { donaldson: 'P550596', fram: null, family: 'OIL' },
  
  // CUMMINS
  'LF3000': { donaldson: 'P550596', fram: 'PH8170', family: 'OIL' },
  'FF5320': { donaldson: 'P551329', fram: 'CS8941', family: 'FUEL' },
  'LF3620': { donaldson: 'P552100', fram: null, family: 'OIL' },
  
  // VOLVO
  '21707133': { donaldson: 'P550596', fram: 'PH8170', family: 'OIL' },
  '20998367': { donaldson: 'P181050', fram: 'CA8755', family: 'AIR' },
  
  // TOYOTA (LD)
  '9091510003': { donaldson: null, fram: 'PH3614', family: 'OIL' },
  '1780179155': { donaldson: null, fram: 'CA10467', family: 'AIR' },
  
  // FORD (LD)
  'FL820S': { donaldson: null, fram: 'PH8170', family: 'OIL' },
  'FA1883': { donaldson: null, fram: 'CA10467', family: 'AIR' },
  
  // NISSAN (LD)
  '152089F60A': { donaldson: null, fram: 'PH10575', family: 'OIL' },
  '165467S00A': { donaldson: null, fram: 'CA11042', family: 'AIR' },
  
  // MANN FILTER - CABIN (LD)
  'CUK2450': { donaldson: null, fram: 'CF11179', family: 'CABIN' },
  
  // FLEETGUARD - HYDRAULIC (HD)
  'HF6710': { donaldson: 'P550388', fram: null, family: 'HYDRAULIC' },
  'HF6555': { donaldson: 'P164378', fram: null, family: 'HYDRAULIC' },
  
  // Agregar más equivalencias aquí...
};

/**
 * Busca equivalencia en la base de datos
 * @param {string} oemNumber - Número OEM normalizado (sin guiones)
 * @param {string} duty - 'HD' o 'LD'
 * @returns {object|null} - {brand, partNumber, family} o null
 */
function findEquivalence(oemNumber, duty) {
  const normalized = oemNumber.toUpperCase().replace(/[-\s]/g, '');
  
  const match = CROSS_REFERENCE_DB[normalized];
  if (!match) return null;
  
  // Si es HD, buscar Donaldson
  if (duty === 'HD' && match.donaldson) {
    return {
      brand: 'DONALDSON',
      partNumber: match.donaldson,
      family: match.family
    };
  }
  
  // Si es LD, buscar FRAM
  if (duty === 'LD' && match.fram) {
    return {
      brand: 'FRAM',
      partNumber: match.fram,
      family: match.family
    };
  }
  
  return null;
}

module.exports = { findEquivalence, CROSS_REFERENCE_DB };
