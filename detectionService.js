// detectionService.js
// ELIMFILTERS Logic v3.3.0

function detectFilter(queryRaw) {
  if (!queryRaw) {
    return { status: "ERROR", message: "Empty query" };
  }

  const query = queryRaw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  let family = "UNKNOWN";
  let duty = "UNKNOWN";
  let source = "GENERIC";
  let homologated_sku = "EXX";

  // ========================
  // 1️⃣ FAMILY DETECTION
  // ========================
  const AIR = ["AIR", "AIRE", "CA", "CF", "RS", "P1", "EAF"];
  const OIL = ["OIL", "ACEITE", "LUBE", "1R", "PH", "LF", "B", "BT"];
  const CABIN = ["CABIN", "A/C", "AC", "CABINA"];
  const HYDRAULIC = ["HYDRAULIC", "HIDRAULICO", "HF", "H"];
  const SEPARATOR = ["SEPARATOR", "SEPARADOR", "PS"];
  const COOLANT = ["COOLANT", "REFRIGERANTE"];
  const AIR_DRYER = ["AIRDRYER", "SECANTE", "DRYER"];
  const TURBINE = ["TURBINA", "PARKER"];
  const HOUSING = ["CARCASA"];
  const KIT_DIESEL = ["KITDIESEL", "MOTORDIESEL"];
  const KIT_GASOLINE = ["KITGAS", "MOTORGASOLINA"];

  const FAMILY_PREFIX = [
    [AIR, "EA1"],
    [OIL, "EL8"],
    [CABIN, "EC1"],
    [HYDRAULIC, "EH6"],
    [SEPARATOR, "ES9"],
    [COOLANT, "EW7"],
    [AIR_DRYER, "ED4"],
    [TURBINE, "ET9"],
    [HOUSING, "EA2"],
    [KIT_DIESEL, "EK5"],
    [KIT_GASOLINE, "EK3"],
  ];

  for (const [patterns, prefix] of FAMILY_PREFIX) {
    if (patterns.some(p => query.includes(p))) {
      family = prefix;
      break;
    }
  }

  // ========================
  // 2️⃣ SOURCE DETECTION
  // ========================
  if (/^P5/i.test(query)) source = "DONALDSON";
  else if (/^PH|CA/i.test(query)) source = "FRAM";
  else if (/^1R|7W|9L|8N/i.test(query)) source = "CATERPILLAR";
  else if (/LF|LFP|LFW/i.test(query)) source = "FLEETGUARD";
  else if (/BF|BT|BW/i.test(query)) source = "BALDWIN";
  else if (/WIX/i.test(query)) source = "WIX";

  // ========================
  // 3️⃣ DUTY DETECTION
  // ========================
  const HD_BRANDS = ["CATERPILLAR", "KOMATSU", "VOLVO", "MACK", "JOHNDEERE", "CUMMINS", "DETROIT"];
  const LD_BRANDS = ["TOYOTA", "FORD", "MAZDA", "LEXUS", "NISSAN", "BMW", "MERCEDES", "CHEVROLET"];

  if (HD_BRANDS.some(b => query.includes(b))) duty = "HD";
  else if (LD_BRANDS.some(b => query.includes(b))) duty = "LD";
  else duty = /1R|P5|HF|FF/i.test(query) ? "HD" : "LD";

  // ========================
  // 4️⃣ HOMOLOGATED SKU LOGIC
  // ========================
  if (source === "DONALDSON") homologated_sku = query;
  else if (source === "FRAM") homologated_sku = query;
  else homologated_sku = "EXX";

  // ========================
  // 5️⃣ FINAL SKU BUILD
  // ========================
  const numPart = query.match(/(\d{4,})$/);
  const last4 = numPart ? numPart[0].slice(-4) : "0000";

  const prefix = family !== "UNKNOWN" ? family : "EXX";
  const final_sku = `${prefix}${last4}`;

  return {
    status: "OK",
    query,
    family: family === "UNKNOWN" ? "UNIDENTIFIED" : family,
    duty,
    source,
    homologated_sku,
    final_sku
  };
}

module.exports = { detectFilter };
