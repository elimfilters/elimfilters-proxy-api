// =========================================
// ELIMFILTERS Detection Logic v4.0.0
// =========================================

function detectFilter(query) {
  const q = query.trim().toUpperCase();
  console.log(`🔎 Analizando código: ${q}`);

  let family = 'UNKNOWN';
  let duty = 'UNKNOWN';
  let source = 'GENERIC';
  let homologated_sku = 'EXX';
  let final_sku = 'EXX0000';

  // === 1️⃣ Detectar tipo de filtro (Family) ===
  const rules = [
    { keys: ["AIR", "AIRE", "CA", "CF", "RS", "P1", "EAF"], result: "AIR", prefix: "EA1" },
    { keys: ["OIL", "ACEITE", "LUBE", "1R", "LF", "PH", "B ", "BT"], result: "OIL", prefix: "EL8" },
    { keys: ["FUEL", "COMBUSTIBLE", "PS", "SEPARATOR", "SEPARADOR"], result: "FUEL SEPARATOR", prefix: "ES9" },
    { keys: ["HYDRAULIC", "HIDRAULICO"], result: "HYDRAULIC", prefix: "EH6" },
    { keys: ["COOLANT", "REFRIGERANTE"], result: "COOLANT", prefix: "EW7" },
    { keys: ["CABIN", "CABINA", "A/C", "AC"], result: "CABIN", prefix: "EC1" },
    { keys: ["DRYER", "SECANTE"], result: "AIR DRYER", prefix: "ED4" },
    { keys: ["TURBINE", "PARKER"], result: "TURBINE", prefix: "ET9" },
    { keys: ["CARCASA"], result: "CARCASA", prefix: "EA2" },
    { keys: ["KIT", "ENGINE", "MOTOR"], result: "KIT", prefix: "EK5" }
  ];

  for (const rule of rules) {
    if (rule.keys.some(k => q.includes(k))) {
      family = rule.result;
      homologated_sku = rule.prefix;
      break;
    }
  }

  // === 2️⃣ Determinar Duty (HD o LD) ===
  const hdMakers = ["CATERPILLAR", "CAT", "KOMATSU", "VOLVO", "MACK", "CUMMINS", "JOHN DEERE", "PERKINS"];
  const ldMakers = ["TOYOTA", "FORD", "NISSAN", "HONDA", "LEXUS", "BMW", "MERCEDES", "MAZDA"];

  if (hdMakers.some(m => q.includes(m))) duty = "HD";
  else if (ldMakers.some(m => q.includes(m))) duty = "LD";

  // === 3️⃣ Verificar fabricantes homologados ===
  if (q.startsWith("P") || q.includes("DONALDSON")) {
    source = "DONALDSON";
  } else if (q.startsWith("PH") || q.includes("FRAM")) {
    source = "FRAM";
  } else {
    source = "OEM";
  }

  // === 4️⃣ Asignar últimos 4 dígitos ===
  const numbers = q.replace(/\D/g, "");
  const last4 = numbers.slice(-4) || "0000";
  final_sku = `${homologated_sku}${last4}`;

  console.log(`✅ Resultado: ${q} → ${final_sku}`);

  return {
    status: "OK",
    query: q,
    family,
    duty,
    source,
    homologated_sku,
    final_sku
  };
}

module.exports = { detectFilter };
