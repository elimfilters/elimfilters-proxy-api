/**
 * ELIMFILTERS detectionService v3.3.0
 * Clasifica el filtro, determina familia, duty y genera SKU.
 */

const detectionService = {
  async detectFilter(query) {
    if (!query) return { status: 'ERROR', message: 'Empty query' };

    const upper = query.trim().toUpperCase();
    let family = 'UNKNOWN';
    let duty = 'UNKNOWN';
    let manufacturer = 'UNKNOWN';
    let homologated = null;
    let finalSku = null;

    // --- 1. Family Detection ---
    const map = [
      { keys: ['AIR', 'AIRE', 'CA', 'CF', 'RS', 'P1', 'EAF'], family: 'AIR', prefix: 'EA1' },
      { keys: ['OIL', 'ACEITE', 'LUBE', '1R', 'PH', 'LF', 'B', 'BT'], family: 'OIL', prefix: 'EL8' },
      { keys: ['FUEL', 'COMBUSTIBLE', 'FF', 'FS', 'P52', 'P77'], family: 'FUEL', prefix: 'EF9' },
      { keys: ['HYDRAULIC', 'HIDRAULICO', 'HF', 'H'], family: 'HYDRAULIC', prefix: 'EH6' },
      { keys: ['SEPARATOR', 'SEPARADOR'], family: 'SEPARATOR', prefix: 'ES9' },
      { keys: ['CABIN', 'A/C', 'AC', 'CABINA'], family: 'CABIN', prefix: 'EC1' },
      { keys: ['COOLANT', 'REFRIGERANTE'], family: 'COOLANT', prefix: 'EW7' },
      { keys: ['AIR DRYER', 'SECANTE'], family: 'AIR DRYER', prefix: 'ED4' },
      { keys: ['PARKER TURBINE SERIES', 'TURBINA'], family: 'TURBINE', prefix: 'ET9' },
      { keys: ['CARCASA'], family: 'HOUSING', prefix: 'EA2' },
      { keys: ['KIT DIESEL', 'MOTOR DIESEL'], family: 'KIT-DIESEL', prefix: 'EK5' },
      { keys: ['KIT GASOLINE', 'MOTOR GASOLINA'], family: 'KIT-GAS', prefix: 'EK3' }
    ];

    for (const m of map) {
      if (m.keys.some(k => upper.includes(k))) {
        family = m.family;
        homologated = m.prefix;
        break;
      }
    }

    // --- 2. Duty Detection (HD vs LD) ---
    const heavyBrands = ['CATERPILLAR', 'KOMATSU', 'MACK', 'VOLVO', 'JOHN DEERE', 'DETROIT', 'DONALDSON', 'BALDWIN'];
    const lightBrands = ['TOYOTA', 'FORD', 'MAZDA', 'LEXUS', 'NISSAN', 'BMW', 'MERCEDES', 'HONDA', 'FRAM', 'PUROLATOR'];

    if (heavyBrands.some(b => upper.includes(b))) duty = 'HD';
    else if (lightBrands.some(b => upper.includes(b))) duty = 'LD';

    // --- 3. Manufacturer Detection ---
    if (upper.includes('DONALDSON')) manufacturer = 'DONALDSON';
    else if (upper.includes('FRAM')) manufacturer = 'FRAM';
    else if (upper.includes('BALDWIN')) manufacturer = 'BALDWIN';
    else if (upper.includes('CAT')) manufacturer = 'CATERPILLAR';
    else manufacturer = 'GENERIC';

    // --- 4. Homologated SKU Logic ---
    const digits = upper.replace(/\D/g, '');
    const lastFour = digits.slice(-4);
    if (homologated && lastFour) {
      finalSku = homologated + lastFour;
    }

    // --- 5. Validate final SKU ---
    if (!finalSku || !/^[A-Z]{2}\d{5}$|^[A-Z]{3}\d{4}$/.test(finalSku)) {
      finalSku = homologated ? homologated + '0000' : 'UNKNOWN';
    }

    // --- 6. Return structured output ---
    return {
      status: 'OK',
      query: upper,
      family,
      duty,
      source: manufacturer,
      homologated_sku: homologated,
      final_sku: finalSku
    };
  }
};

module.exports = detectionService;
