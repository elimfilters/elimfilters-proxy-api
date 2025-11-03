/**
 * detectionService.js v3.3.2
 * Sistema de detección de familia, duty y SKU ELIMFILTERS
 */

const detectionService = {

  /**
   * Detecta familia, tipo de filtro y prefijo correcto según las reglas ELIMFILTERS
   * @param {string} query Código o texto de entrada
   * @returns {Object} { family, filter_type, prefix, duty }
   */
  detectFamilyAndType(query) {
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

    return { family: "UNKNOWN", filter_type: "UNDEFINED", prefix: "EXX", duty: "UNKNOWN" };
  },

  /**
   * Determina si el filtro pertenece a HD o LD basándose en fabricante o tipo de aplicación
   * @param {string} context Texto con marca, modelo o motor
   * @returns {"HD"|"LD"|"UNKNOWN"}
   */
  detectDuty(context) {
    const text = (context || "").toUpperCase();

    const heavy = [
      "CATERPILLAR", "CAT", "KOMATSU", "CUMMINS", "VOLVO TRUCK", "VOLVO PENTA", "MACK",
      "JOHN DEERE", "DETROIT DIESEL", "DETROIT", "PERKINS", "CASE", "NEW HOLLAND", "SCANIA",
      "MERCEDES TRUCK", "MERCEDES BENZ TRUCK", "KENWORTH", "PETERBILT", "FREIGHTLINER",
      "INTERNATIONAL", "NAVISTAR", "MTU", "PACCAR", "HINO", "IVECO", "ISUZU HD",
      "RENAULT TRUCKS", "WESTERN STAR", "STERLING", "FORD CARGO", "DODGE RAM HD", "DAF",
      "FUSO", "TATA", "ASHOK LEYLAND", "AGCO", "CLAAS", "DEUTZ", "YANMAR", "BELARUS"
    ];

    const light = [
      "TOYOTA", "LEXUS", "HONDA", "ACURA", "NISSAN", "INFINITI", "FORD", "MAZDA", "MITSUBISHI",
      "BMW", "MINI", "MERCEDES", "VW", "VOLKSWAGEN", "AUDI", "PORSCHE", "SEAT", "SKODA",
      "CHEVROLET", "GMC", "CADILLAC", "BUICK", "CHRYSLER", "DODGE", "JEEP", "RAM", "FIAT",
      "PEUGEOT", "RENAULT", "CITROEN", "HYUNDAI", "KIA", "SUZUKI", "ISUZU", "GEELY",
      "MG", "CHERY", "JAC", "BYD", "TESLA", "VOLVO CAR"
    ];

    if (heavy.some(k => text.includes(k))) return "HD";
    if (light.some(k => text.includes(k))) return "LD";
    return "UNKNOWN";
  },

  /**
   * Normaliza el query, detecta parámetros técnicos y arma base preliminar
   */
  detectFilter(query) {
    const query_norm = query.trim().toUpperCase();

    // Detecta familia / tipo
    const { family, filter_type, prefix, duty: familyDuty } = detectionService.detectFamilyAndType(query_norm);

    // Detecta HD/LD real
    const detectedDuty = detectionService.detectDuty(query_norm);
    const duty = familyDuty === "AUTO" ? detectedDuty : familyDuty;

    // Últimos 4 dígitos numéricos válidos
    const numericPart = query_norm.match(/\d{4}$/)?.[0] || "0000";
    const final_sku = `${prefix}${numericPart}`;

    return {
      status: "OK",
      query_norm,
      family,
      duty,
      filter_type,
      prefix,
      final_sku,
      source: "LOCAL-DETECTION",
      description: `General-purpose ${filter_type.toLowerCase()} for ${duty} applications.`
    };
  }
};

module.exports = detectionService;
