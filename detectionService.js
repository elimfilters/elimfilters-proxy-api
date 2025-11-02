// =========================
// FAMILY DETECTION RULES v3.6.0
// =========================

function detectFilterFamily(query, context = '') {
  const combined = (query + ' ' + context).toUpperCase();

  const patterns = {
    'AIR': [
      'AIR FILTER', 'AIRE', 'RADIAL SEAL', 'INNER ELEMENT',
      'OUTER ELEMENT', 'PRIMARY AIR', 'SECONDARY AIR'
    ],
    'OIL': [
      'OIL FILTER', 'LUBE FILTER', 'ACEITE', 'LUBRICANTE', 'MOTOR OIL'
    ],
    'FUEL': [
      'FUEL FILTER', 'FILTRO DE COMBUSTIBLE', 'DIESEL FILTER', 'GASOLINE FILTER'
    ],
    'SEPARATOR': [
      'FUEL WATER SEPARATOR', 'SEPARATOR', 'SEPARADOR', 'COALESCER'
    ],
    'HYDRAULIC': [
      'HYDRAULIC FILTER', 'HIDRAULICO', 'RETURN LINE', 'SUCTION FILTER'
    ],
    'COOLANT': [
      'COOLANT FILTER', 'REFRIGERANTE', 'WATER FILTER'
    ],
    'CABIN': [
      'CABIN FILTER', 'CABINA', 'A/C FILTER', 'INTERIOR FILTER'
    ],
    'AIR DRYER': [
      'AIR DRYER', 'SECANTE', 'DESHUMIDIFICADOR', 'BRAKE DRYER'
    ],
    'TURBINE': [
      'PARKER TURBINE SERIES', 'TURBINA PARKER', 'TURBINE SEPARATOR',
      'TURBINE SERIES', 'TURBINA SEPARADOR'
    ],
    'HOUSING': [
      'CARCASA', 'HOUSING', 'FILTER HOUSING', 'BODY FILTER'
    ],
    'KIT DIESEL': [
      'KIT DIESEL', 'DIESEL ENGINE KIT'
    ],
    'KIT GASOLINE': [
      'KIT GASOLINA', 'GASOLINE ENGINE KIT'
    ]
  };

  const mapping = {
    'AIR': { prefix: 'EA1', duty: 'HD/LD' },
    'OIL': { prefix: 'EL8', duty: 'HD/LD' },
    'FUEL': { prefix: 'EF9', duty: 'HD/LD' },
    'SEPARATOR': { prefix: 'ES9', duty: 'HD' },
    'HYDRAULIC': { prefix: 'EH6', duty: 'HD' },
    'COOLANT': { prefix: 'EW7', duty: 'HD' },
    'CABIN': { prefix: 'EC1', duty: 'HD/LD' },
    'AIR DRYER': { prefix: 'ED4', duty: 'HD' },
    'TURBINE': { prefix: 'ET9', duty: 'HD' },
    'HOUSING': { prefix: 'EA2', duty: 'HD' },
    'KIT DIESEL': { prefix: 'EK5', duty: 'HD' },
    'KIT GASOLINE': { prefix: 'EK3', duty: 'LD' }
  };

  let detected = 'UNKNOWN';
  let score = 0;

  for (const [family, keys] of Object.entries(patterns)) {
    for (const keyword of keys) {
      if (combined.includes(keyword)) {
        detected = family;
        score++;
      }
    }
  }

  return {
    family: detected,
    confidence: score > 0 ? 1.0 : 0,
    prefix: mapping[detected]?.prefix || null,
    duty_hint: mapping[detected]?.duty || null
  };
}
