const normalizeQuery = require('./utils/normalizeQuery');
let sheetsInstance = null;

function setSheetsInstance(instance) {
  sheetsInstance = instance;
}

/**
 * Detecta tipo de filtro, duty, y genera SKU
 */
async function detectFilter(rawQuery) {
  const query = normalizeQuery(rawQuery);
  const response = { status: 'OK', query_norm: query };

  // --- 1. Si está en Google Sheets ---
  if (sheetsInstance && typeof sheetsInstance.findRowByQuery === 'function') {
    const existingRow = await sheetsInstance.findRowByQuery(query);
    if (existingRow) {
      return { status: 'OK', source: 'Master', data: existingRow };
    }
  }

  // --- 2. Detectar tipo de filtro ---
  const ref = query.toUpperCase();
  let family = 'UNKNOWN';
  let duty = 'UNKNOWN';
  let source = 'Generated';
  let homologated_sku = 'EXX';
  let final_sku = '';

  // --- Clasificación Family ---
  const patterns = {
    AIR: ["AIR", "AIRE", "CA", "CF", "RS", "P1", "EAF"],
    OIL: ["OIL", "ACEITE", "LUBE", "1R", "PH", "LF", "B", "BT"],
    FUEL: ["FUEL", "COMBUSTIBLE", "GASOIL", "FS", "FF", "PS"],
    HYDRAULIC: ["HYDRAULIC", "HIDRAULICO", "H"],
    CABIN: ["CABIN", "AC", "A/C", "CABINA"],
    SEPARATOR: ["SEPARATOR", "SEPARADOR"],
    COOLANT: ["COOLANT", "REFRIGERANTE"],
    AIR_DRYER: ["AIR DRYER", "SECANTE", "SECADOR"],
    TURBINE: ["TURBINE", "PARKER TURBINE SERIES"],
    HOUSING: ["CARCASA", "HOUSING"],
    KIT: ["KIT"]
  };

  for (const [fam, keys] of Object.entries(patterns)) {
    if (keys.some(k => ref.includes(k))) {
      family = fam;
      break;
    }
  }

  // --- 3. Clasificar Duty por fabricante (motor) ---
  const hdBrands = [
    "CATERPILLAR", "KOMATSU", "CUMMINS", "VOLVO", "MACK", "JOHN DEERE", "DETROIT",
    "PERKINS", "CASE", "NEW HOLLAND", "SCANIA", "MERCEDES TRUCK", "KENWORTH",
    "PETERBILT", "FREIGHTLINER", "INTERNATIONAL", "MTU", "PACCAR", "HINO", "IVECO"
  ];

  const ldBrands = [
    "TOYOTA", "FORD", "NISSAN", "HONDA", "BMW", "MERCEDES", "LEXUS", "MAZDA",
    "SUZUKI", "HYUNDAI", "KIA", "CHEVROLET", "VOLKSWAGEN"
  ];

  if (hdBrands.some(b => ref.includes(b))) duty = 'HD';
  else if (ldBrands.some(b => ref.includes(b))) duty = 'LD';

  // --- 4. Prefijos de SKU ---
  const prefixes = {
    AIR: "EA1",
    FUEL: "EF9",
    OIL: "EL8",
    CABIN: "EC1",
    SEPARATOR: "ES9",
    HYDRAULIC: "EH6",
    COOLANT: "EW7",
    AIR_DRYER: "ED4",
    TURBINE: "ET9",
    HOUSING: "EA2",
    KIT: "EK5"
  };

  homologated_sku = prefixes[family] || "EXX";

  // --- 5. Extraer los últimos 4 dígitos ---
  const match = query.match(/(\d{4})$/);
  const last4 = match ? match[1] : "0000";
  final_sku = `${homologated_sku}${last4}`;

  response.family = family;
  response.duty = duty;
  response.source = source;
  response.homologated_sku = homologated_sku;
  response.final_sku = final_sku;

  // --- 6. Si existe instancia de Sheet, guardar ---
  if (sheetsInstance && typeof sheetsInstance.appendRow === 'function') {
    try {
      await sheetsInstance.appendRow({
        query_norm: query,
        sku: final_sku,
        family,
        duty,
        oem_codes: '',
        cross_reference: '',
        filter_type: '',
        media_type: '',
        description: 'General-purpose filter record.'
      });
    } catch (err) {
      console.error('⚠️ Error guardando en Sheet:', err.message);
    }
  }

  return { status: 'OK', source, data: response };
}

module.exports = { detectFilter, setSheetsInstance };
