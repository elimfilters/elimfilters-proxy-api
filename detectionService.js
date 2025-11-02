// === REGLAS DE HOMOLOGACIÓN ===
function buildFinalSKU(query, family, duty, baseSource) {
  // Normalizar entrada
  const code = query.toUpperCase().trim();

  // Últimos 4 dígitos NUMÉRICOS (solo números)
  const digits = code.replace(/\D/g, '').slice(-4) || '0000';

  // --- Prefijos sólidos según tipo ---
  const prefixMap = {
    AIR: 'EA1',
    FUEL: duty === 'HD' ? 'EF9' : 'EF9',
    OIL: 'EL8',
    CABIN: 'EC1',
    SEPARATOR: 'ES9',
    HYDRAULIC: 'EH6',
    COOLANT: 'EW7',
    DRYER: 'ED4',
    TURBINE: 'ET9',
    HOUSING: 'EA2',
    KIT_DIESEL: 'EK5',
    KIT_GASOLINE: 'EK3'
  };

  const prefix = prefixMap[family] || 'EXX';

  // --- REGLAS DE FABRICANTE ---
  let finalSKU = null;

  // 1️⃣ Si es Donaldson → usar mismos 4 últimos dígitos del código Donaldson.
  if (baseSource === 'DONALDSON') {
    finalSKU = `${prefix}${digits}`;
  }

  // 2️⃣ Si es Fram → usar últimos 4 dígitos del código Fram.
  else if (baseSource === 'FRAM') {
    finalSKU = `${prefix}${digits}`;
  }

  // 3️⃣ Si no hay fabricante conocido → usar los últimos 4 dígitos del OEM más comercial.
  else {
    finalSKU = `${prefix}${digits}`;
  }

  // 4️⃣ Validación final: solo números al final.
  if (!/^\d{4}$/.test(digits)) {
    finalSKU = `${prefix}0000`;
  }

  return {
    query,
    family,
    duty,
    source: baseSource || 'GENERIC',
    homologated_sku: prefix,
    final_sku: finalSKU
  };
}
