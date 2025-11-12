// scrapers/utils.js v1.0.0
// Utilidades compartidas para scrapers

/**
 * Limpia y normaliza un array eliminando duplicados y vacíos
 * @param {Array} arr - Array a limpiar
 * @param {number} maxItems - Número máximo de elementos (default: 10)
 * @returns {Array} - Array limpio
 */
function cleanArray(arr, maxItems = 10) {
  if (!Array.isArray(arr)) return [];
  
  const cleaned = arr
    .map(item => typeof item === 'string' ? item.trim() : String(item))
    .filter(item => item && item.length > 0)
    .filter((item, index, self) => self.indexOf(item) === index); // Eliminar duplicados
  
  return cleaned.slice(0, maxItems);
}

/**
 * Formatea una aplicación de motor al formato estándar
 * @param {string} text - Texto original
 * @returns {string} - Formato: "Motor (Displacement) – Years"
 */
function formatEngineApplication(text) {
  if (!text) return '';
  
  // Intentar extraer componentes
  const match = text.match(/([A-Za-z0-9\s]+)\s*\(?([0-9.]+\s*L)?\)?\s*[-–]?\s*(\d{4})?\s*[-–]?\s*(\d{4})?/);
  
  if (match) {
    const engine = match[1].trim();
    const displacement = match[2] ? `(${match[2].trim()})` : '';
    const yearStart = match[3] || '';
    const yearEnd = match[4] || 'Present';
    
    if (yearStart) {
      return `${engine} ${displacement} – ${yearStart}–${yearEnd}`.trim();
    }
    return `${engine} ${displacement}`.trim();
  }
  
  return text.trim();
}

/**
 * Formatea una aplicación de equipo al formato estándar
 * @param {string} text - Texto original
 * @returns {string} - Formato: "Equipment (Years)"
 */
function formatEquipmentApplication(text) {
  if (!text) return '';
  
  // Intentar extraer componentes
  const match = text.match(/([A-Za-z0-9\s]+)\s*\(?(\d{4})?\s*[-–]?\s*(\d{4})?\)?/);
  
  if (match) {
    const equipment = match[1].trim();
    const yearStart = match[2] || '';
    const yearEnd = match[3] || 'Present';
    
    if (yearStart) {
      return `${equipment} (${yearStart}–${yearEnd})`;
    }
    return equipment;
  }
  
  return text.trim();
}

/**
 * Extrae número de un texto (para specs)
 * @param {string} text - Texto con número
 * @returns {string} - Solo el número
 */
function extractNumber(text) {
  if (!text) return '';
  const match = text.match(/[\d.]+/);
  return match ? match[0] : '';
}

/**
 * Convierte millas a kilómetros
 * @param {string|number} miles - Millas
 * @returns {string} - Kilómetros
 */
function milesToKm(miles) {
  if (!miles) return '';
  const num = parseFloat(miles);
  if (isNaN(num)) return '';
  return Math.round(num * 1.60934).toString();
}

/**
 * Normaliza specs técnicas
 * @param {object} specs - Objeto con specs raw
 * @returns {object} - Specs normalizadas
 */
function normalizeSpecs(specs) {
  const normalized = {
    rated_flow_gpm: '',
    service_life_hours: '',
    change_interval_km: '',
    water_separation_efficiency_percent: '',
    drain_type: '',
    micron_rating: '',
    collapse_pressure_psi: ''
  };
  
  if (specs.rated_flow_gpm) {
    normalized.rated_flow_gpm = extractNumber(specs.rated_flow_gpm);
  }
  
  if (specs.service_life_hours) {
    normalized.service_life_hours = extractNumber(specs.service_life_hours);
  }
  
  if (specs.change_interval_km) {
    normalized.change_interval_km = extractNumber(specs.change_interval_km);
  } else if (specs.change_interval_miles) {
    normalized.change_interval_km = milesToKm(specs.change_interval_miles);
  }
  
  if (specs.water_separation_efficiency_percent) {
    normalized.water_separation_efficiency_percent = extractNumber(specs.water_separation_efficiency_percent);
  }
  
  if (specs.drain_type) {
    normalized.drain_type = specs.drain_type.trim();
  }
  
  if (specs.micron_rating) {
    normalized.micron_rating = extractNumber(specs.micron_rating);
  }
  
  if (specs.collapse_pressure_psi) {
    normalized.collapse_pressure_psi = extractNumber(specs.collapse_pressure_psi);
  }
  
  return normalized;
}

/**
 * Genera descripción por defecto si no se encuentra
 * @param {string} sku - SKU del filtro
 * @param {string} family - Familia del filtro
 * @param {string} duty - HD o LD
 * @returns {string} - Descripción por defecto
 */
function generateDefaultDescription(sku, family, duty) {
  const dutyLabel = duty === 'HD' ? 'heavy-duty' : 'light-duty';
  const dutyLabelEs = duty === 'HD' ? 'servicio pesado' : 'servicio liviano';
  
  return `The ${sku} is a high-quality ${family} filter for ${dutyLabel} applications, manufactured to OEM standards. / ` +
         `El ${sku} es un filtro de ${family} de alta calidad para aplicaciones de ${dutyLabelEs}, fabricado bajo estándares OEM.`;
}

/**
 * Combina datos de scraping con valores por defecto
 * @param {object} scrapedData - Datos del scraping
 * @param {string} family - Familia del filtro
 * @param {string} duty - HD o LD
 * @returns {object} - Datos completos
 */
function combineWithDefaults(scrapedData, family, duty) {
  // Valores por defecto según familia y duty
  const defaults = {
    'OIL|HD': { rated_flow_gpm: '25', service_life_hours: '500', change_interval_km: '40000' },
    'OIL|LD': { rated_flow_gpm: '20', service_life_hours: '400', change_interval_km: '16000' },
    'FUEL|HD': { rated_flow_gpm: '20', service_life_hours: '500', change_interval_km: '40000' },
    'FUEL|LD': { rated_flow_gpm: '15', service_life_hours: '400', change_interval_km: '24000' },
    'AIR|HD': { rated_flow_gpm: '1500', service_life_hours: '2000', change_interval_km: '80000' },
    'AIR|LD': { rated_flow_gpm: '800', service_life_hours: '1000', change_interval_km: '48000' },
    'CABIN|HD': { service_life_hours: '2000', change_interval_km: '80000' },
    'CABIN|LD': { service_life_hours: '1000', change_interval_km: '24000' }
  };
  
  const key = `${family}|${duty}`;
  const defaultSpecs = defaults[key] || {};
  
  // Combinar specs: usar scraped si existe, sino default
  const combinedSpecs = { ...defaultSpecs };
  
  if (scrapedData.specs) {
    Object.keys(scrapedData.specs).forEach(key => {
      if (scrapedData.specs[key]) {
        combinedSpecs[key] = scrapedData.specs[key];
      }
    });
  }
  
  return {
    ...scrapedData,
    specs: combinedSpecs
  };
}

module.exports = {
  cleanArray,
  formatEngineApplication,
  formatEquipmentApplication,
  extractNumber,
  milesToKm,
  normalizeSpecs,
  generateDefaultDescription,
  combineWithDefaults
};
