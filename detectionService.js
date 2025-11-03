// =========================================
// detectionService.js v4.1 — ELIMFILTERS
// =========================================

const detectionService = {
  detectFilter(query) {
    const q = query.trim().toUpperCase();
    const result = {
      status: "OK",
      query_norm: q,
      family: "UNKNOWN",
      duty: "UNKNOWN",
      source: "GENERIC",
      homologated_sku: "EXX",
      final_sku: ""
    };

    // ===============================
    // 1. FAMILY DETECTION (Tipo)
    // ===============================
    if (/(AIR|AIRE|CA|CF|RS|P1|EAF|P52|P527|P778|P777)/.test(q)) result.family = "AIR";
    else if (/(OIL|ACEITE|LUBE|1R|PH|LF|B|BT)/.test(q)) result.family = "OIL";
    else if (/(CABIN|A\/C|AC|CABINA)/.test(q)) result.family = "CABIN";
    else if (/(HYDRAULIC|HIDRAULICO|HF)/.test(q)) result.family = "HYDRAULIC";
    else if (/(COOLANT|REFRIGERANTE)/.test(q)) result.family = "COOLANT";
    else if (/(SEPARATOR|SEPARADOR|PS)/.test(q)) result.family = "FUEL SEPARATOR";
    else if (/(TURBINE|PARKER)/.test(q)) result.family = "TURBINE SERIES";
    else if (/(KIT|ENGINE)/.test(q)) result.family = "ENGINE KIT";

    // ===============================
    // 2. DUTY (HD / LD)
    // ===============================
    const hdMakers = /(CATERPILLAR|KOMATSU|VOLVO|MACK|CUMMINS|DETROIT|JOHN ?DEERE|DONALDSON)/;
    const ldMakers = /(TOYOTA|FORD|NISSAN|LEXUS|HONDA|MAZDA|BMW|MERCEDES|CHEVROLET)/;

    if (hdMakers.test(q)) result.duty = "HD";
    else if (ldMakers.test(q)) result.duty = "LD";
    else if (/(1R|HF|P52|P77|P55|RS|CA)/.test(q)) result.duty = "HD";
    else if (/(PH|CF|FRAM|ACDELCO|TOYOTA)/.test(q)) result.duty = "LD";

    // ===============================
    // 3. PREFIJO SEGÚN FAMILY
    // ===============================
    const prefixMap = {
      AIR: "EA1",
      FUEL: "EF9",
      "FUEL SEPARATOR": "ES9",
      OIL: "EL8",
      CABIN: "EC1",
      HYDRAULIC: "EH6",
      COOLANT: "EW7",
      "AIR DRYER": "ED4",
      "TURBINE SERIES": "ET9",
      "ENGINE KIT": "EK5"
    };

    const prefix = prefixMap[result.family] || "EXX";

    // ===============================
    // 4. HOMOLOGACIÓN (Donaldson / Fram)
    // ===============================
    if (result.duty === "HD") {
      result.source = "DONALDSON";
    } else if (result.duty === "LD") {
      result.source = "FRAM";
    }

    // ===============================
    // 5. CÓDIGO NUMÉRICO FINAL
    // ===============================
    const digits = q.replace(/\D/g, "");
    const last4 = digits.slice(-4) || "0000";

    // Si el código pertenece al propio Donaldson (P-series)
    if (/^P\d{5,}/.test(q)) {
      result.homologated_sku = q;
      result.final_sku = prefix + last4;
    } else {
      result.homologated_sku = result.source;
      result.final_sku = prefix + last4;
    }

    // ===============================
    // 6. DESCRIPCIÓN BASE
    // ===============================
    const familyDesc = {
      AIR: "High-efficiency air element for intake systems.",
      OIL: "Precision oil filtration element for lubrication systems.",
      CABIN: "Cabin air filter for interior air quality control.",
      HYDRAULIC: "Hydraulic system filter for pressure and return circuits.",
      COOLANT: "Coolant filter for thermal regulation systems.",
      "FUEL SEPARATOR": "Fuel-water separator filter for diesel applications.",
      "TURBINE SERIES": "Turbine-style high-performance separator filter.",
      "ENGINE KIT": "Integrated filter kit for engine service operations."
    };

    result.description = familyDesc[result.family] || "General-purpose filtration component.";

    return result;
  }
};

module.exports = detectionService;
