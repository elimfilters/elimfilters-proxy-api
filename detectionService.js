/**
 * Detecta familia, tipo de filtro y prefijo correcto según las reglas ELIMFILTERS
 * @param {string} query Código o texto de entrada
 * @returns {Object} { family, filter_type, prefix }
 */
function detectFamilyAndType(query) {
  const q = (query || "").toUpperCase().trim();

  const rules = [
    { family: "AIR", keywords: ["AIR", "AIRE", "CA", "CF", "RS", "P1", "EAF"], prefix: "EA1", duty: "AUTO" },
    { family: "FUEL", keywords: ["FUEL", "COMBUSTIBLE", "FF", "FS"], prefix: "EF9", duty: "AUTO" },
    { family: "OIL", keywords: ["OIL", "ACEITE", "1R", "PH", "LF", "B ", "BT"], prefix: "EL8", duty: "AUTO" },
    { family: "CABIN", keywords: ["CABIN", "CABINA", "A/C", "AC"], prefix: "EC1", duty: "AUTO" },
    { family: "HYDRAULIC", keywords: ["HYDRAULIC", "HIDRAULICO", "HF", "H "], prefix: "EH6", duty: "HD" },
    { family: "COOLANT", keywords: ["COOLANT", "REFRIGERANTE"], prefix: "EW7", duty: "HD" },
    { family: "SEPARATOR", keywords: ["SEPARATOR", "SEPARADOR", "PS"], prefix: "ES9", duty: "HD" },
    { family: "AIR DRYER", keywords: ["AIR DRYER", "SECANTE", "BRAKE", "FRENO"], prefix: "ED4", duty: "HD" },
    { family: "TURBINE", keywords: ["TURBINE", "PARKER", "TURBINA"], prefix: "ET9", duty: "HD" },
    { family: "AIR HOUSING", keywords: ["CARCASA", "HOUSING", "AIR HOUSING"], prefix: "EA2", duty: "HD" },
    { family: "KIT DIESEL ENGINE", keywords: ["KIT DIESEL", "MOTOR DIESEL"], prefix: "EK5", duty: "HD" },
    { family: "KIT GASOLINE ENGINE", keywords: ["KIT GASOLINE", "MOTOR GASOLINA"], prefix: "EK3", duty: "LD" },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(k => q.includes(k))) {
      return {
        family: rule.family,
        filter_type: `${rule.family} FILTER`,
        prefix: rule.prefix,
        duty: rule.duty
      };
    }
  }

  // Si no hay coincidencia exacta
  return { family: "UNKNOWN", filter_type: "UNDEFINED", prefix: "EXX", duty: "UNKNOWN" };
}
