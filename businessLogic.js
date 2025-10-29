// businessLogic.js - v2.2.3 CORREGIDO
// Lógica de negocio con reglas PROTEGIDAS e INMUTABLES v2.2.0

const rulesProtection = require('./rulesProtection');

// ============================================================================
// CARGAR REGLAS PROTEGIDAS CORREGIDAS
// ============================================================================

const PROTECTED_RULES = rulesProtection.getProtectedRules();

console.log('🔒 Protected Rules v2.2.0 (corrected v2.2.3) loaded successfully');
console.log(`   Version: ${PROTECTED_RULES.version}`);
console.log(`   Correction: ${PROTECTED_RULES.correctionVersion || 'N/A'}`);
console.log(`   Rules: ${Object.keys(PROTECTED_RULES.rules).length}`);
console.log(`   Decision Table: ${Object.keys(PROTECTED_RULES.decisionTable).length} combinations`);

// ============================================================================
// FUNCIONES DE EXTRACCIÓN DE DÍGITOS
// ============================================================================

/**
 * Extrae SOLO los números de un código OEM
 * Elimina letras, guiones, espacios, símbolos
 * 
 * @param {string} code - Código OEM (puede contener cualquier caracter)
 * @returns {string} Solo los dígitos (0-9)
 * 
 * @example
 * extractNumbers('P552100') → '552100'
 * extractNumbers('87139-07010') → '8713907010'
 * extractNumbers('PH8A') → '8'
 */
function extractNumbers(code) {
  if (!code) return '';
  // Reemplazar todo lo que NO sea número (0-9) con cadena vacía
  return code.replace(/[^0-9]/g, '');
}

/**
 * Obtiene los últimos 4 dígitos de un código OEM
 * Si tiene menos de 4 dígitos, rellena con ceros a la izquierda
 * 
 * @param {string} code - Código OEM
 * @returns {string} Últimos 4 dígitos (siempre 4 caracteres)
 * @throws {Error} Si no hay números en el código
 * 
 * @example
 * getLast4Digits('P552100') → '2100'
 * getLast4Digits('87139-07010') → '7010'
 * getLast4Digits('PH8A') → '0008'
 * getLast4Digits('CA10234') → '0234'
 */
function getLast4Digits(code) {
  // Paso 1: Extraer solo números
  const numbers = extractNumbers(code);
  
  // Validar que hay al menos un número
  if (numbers.length === 0) {
    throw new Error(`No numbers found in OEM code: ${code}`);
  }
  
  // Paso 2a: Si tiene menos de 4 dígitos, rellenar con ceros a la izquierda
  if (numbers.length < 4) {
    return numbers.padStart(4, '0');
  }
  
  // Paso 2b: Si tiene 4 o más dígitos, tomar los últimos 4
  return numbers.slice(-4);
}

// ============================================================================
// FUNCIONES DE GENERACIÓN DE SKU
// ============================================================================

/**
 * Obtiene el prefijo según Family y Duty usando reglas protegidas
 * 
 * @param {string} family - Familia del filtro
 * @param {string} duty - Duty del filtro (HD o LD)
 * @returns {string} Prefijo correspondiente
 * @throws {Error} Si no existe prefix para esa combinación
 */
function getPrefix(family, duty) {
  const prefix = rulesProtection.getPrefix(family, duty);
  
  if (!prefix) {
    const available = rulesProtection.getAvailableCombinations();
    throw new Error(
      `No prefix found for Family: ${family}, Duty: ${duty}. ` +
      `Available combinations: ${available.join(', ')}`
    );
  }
  
  return prefix;
}

/**
 * Genera el SKU ELIMFILTERS según reglas v2.2.0 corregidas
 * 
 * @param {object} filterData - Datos del filtro
 * @param {string} filterData.family - Familia del filtro
 * @param {string} filterData.duty - Duty del filtro (HD o LD)
 * @param {string} filterData.oem_code - Código OEM del fabricante
 * @returns {object} { sku, prefix, last4, rule, version }
 * 
 * @example
 * generateSKU({ 
 *   family: 'OIL', 
 *   duty: 'HD', 
 *   oem_code: 'P552100' 
 * })
 * // Retorna:
 * // {
 * //   sku: 'EL82100',
 * //   prefix: 'EL8',
 * //   last4: '2100',
 * //   rule: 'OIL|HD',
 * //   version: '2.2.0'
 * // }
 */
function generateSKU(filterData) {
  const { family, duty, oem_code } = filterData;
  
  // Validar inputs requeridos
  if (!family || !duty || !oem_code) {
    throw new Error('Missing required fields: family, duty, oem_code');
  }
  
  // Validar que las reglas no han sido alteradas (seguridad)
  rulesProtection.validateRulesNotAltered(PROTECTED_RULES);
  
  // Paso 1: Obtener prefijo según reglas protegidas
  const prefix = getPrefix(family.toUpperCase(), duty.toUpperCase());
  
  // Paso 2: Extraer últimos 4 dígitos del código OEM
  const last4 = getLast4Digits(oem_code);
  
  // Paso 3: Generar SKU = PREFIX + 4 DÍGITOS
  const sku = `${prefix}${last4}`;
  
  // Paso 4: Identificar la regla usada
  const ruleKey = `${family.toUpperCase()}|${duty.toUpperCase()}`;
  
  return {
    sku,
    prefix,
    last4,
    rule: ruleKey,
    version: PROTECTED_RULES.version,
    correctionVersion: PROTECTED_RULES.correctionVersion
  };
}

/**
 * Genera múltiples SKUs para un array de códigos OEM
 * Útil para procesamiento en batch
 * 
 * @param {string} family - Familia del filtro
 * @param {string} duty - Duty del filtro
 * @param {string[]} oemCodes - Array de códigos OEM
 * @returns {object[]} Array de resultados con success/error por cada código
 */
function generateMultipleSKUs(family, duty, oemCodes) {
  // Validar reglas antes de procesar múltiples SKUs
  rulesProtection.validateRulesNotAltered(PROTECTED_RULES);
  
  return oemCodes.map(oem_code => {
    try {
      return {
        oem_code,
        ...generateSKU({ family, duty, oem_code }),
        success: true
      };
    } catch (error) {
      return {
        oem_code,
        success: false,
        error: error.message
      };
    }
  });
}

/**
 * Valida que un SKU tenga el formato correcto
 * Formato esperado: 3 caracteres (prefix) + 4 dígitos
 * 
 * @param {string} sku - SKU a validar
 * @returns {boolean} true si es válido
 * 
 * @example
 * validateSKU('EL82100') → true
 * validateSKU('XX99999') → false (prefix no existe)
 * validateSKU('EL8210') → false (solo 6 caracteres)
 */
function validateSKU(sku) {
  if (!sku || typeof sku !== 'string') {
    return false;
  }
  
  // Formato: PREFIXNNNN (ejemplo: EL82100)
  // Longitud: siempre 7 caracteres
  if (sku.length !== 7) {
    return false;
  }
  
  // Extraer prefijo (primeros 3 caracteres)
  const prefix = sku.substring(0, 3);
  
  // Extraer últimos 4 (deben ser números)
  const last4 = sku.substring(3);
  if (!/^\d{4}$/.test(last4)) {
    return false;
  }
  
  // Validar que el prefijo existe en las reglas protegidas
  return rulesProtection.isValidPrefix(prefix);
}

/**
 * Obtiene información sobre las reglas (sin exponer reglas completas)
 * Útil para debugging y health checks
 * 
 * @returns {object} Info de reglas
 */
function getRulesInfo() {
  return {
    version: PROTECTED_RULES.version,
    correctionVersion: PROTECTED_RULES.correctionVersion,
    lastUpdate: PROTECTED_RULES.lastUpdate,
    totalRules: Object.keys(PROTECTED_RULES.rules).length,
    totalCombinations: Object.keys(PROTECTED_RULES.decisionTable).length,
    availableFamilies: [...new Set(
      Object.keys(PROTECTED_RULES.decisionTable).map(k => k.split('|')[0])
    )],
    protected: true,
    frozen: Object.isFrozen(PROTECTED_RULES)
  };
}

// ============================================================================
// EJEMPLO DE USO
// ============================================================================

/**
 * Ejemplo de cómo usar el sistema de generación protegido
 */
function example() {
  console.log('\n' + '='.repeat(70));
  console.log('📋 EJEMPLOS DE USO - businessLogic.js v2.2.3');
  console.log('='.repeat(70) + '\n');
  
  // Ejemplo 1: Generar SKU para un filtro
  console.log('📌 Ejemplo 1: Generar un SKU\n');
  const filter1 = {
    family: 'OIL',
    duty: 'HD',
    oem_code: 'P552100'
  };
  
  const result1 = generateSKU(filter1);
  console.log('   Input:', JSON.stringify(filter1));
  console.log('   Output:', result1);
  console.log('   SKU:', result1.sku, '← EL82100\n');
  
  // Ejemplo 2: Código con guión
  console.log('📌 Ejemplo 2: Código con guión\n');
  const result2 = generateSKU({
    family: 'CABIN',
    duty: 'HD',
    oem_code: '87139-07010'
  });
  console.log('   OEM Code: 87139-07010');
  console.log('   SKU:', result2.sku, '← EC17010');
  console.log('   Last 4:', result2.last4, '← Extrae 7010\n');
  
  // Ejemplo 3: Código corto
  console.log('📌 Ejemplo 3: Código corto (rellena con ceros)\n');
  const result3 = generateSKU({
    family: 'FUEL',
    duty: 'LD',
    oem_code: 'PH8A'
  });
  console.log('   OEM Code: PH8A');
  console.log('   SKU:', result3.sku, '← EF90008');
  console.log('   Last 4:', result3.last4, '← Rellena 8 → 0008\n');
  
  // Ejemplo 4: Generar múltiples SKUs
  console.log('📌 Ejemplo 4: Batch de SKUs\n');
  const results = generateMultipleSKUs('OIL', 'HD', [
    'P552100',
    'DBL7900',
    'P550949'
  ]);
  console.log('   Resultados:');
  results.forEach(r => {
    console.log(`   - ${r.oem_code} → ${r.sku}`);
  });
  console.log('');
  
  // Ejemplo 5: Validar SKU
  console.log('📌 Ejemplo 5: Validar SKUs\n');
  console.log('   EL82100 válido?', validateSKU('EL82100')); // true
  console.log('   XX99999 válido?', validateSKU('XX99999')); // false
  console.log('   EL8210 válido?', validateSKU('EL8210')); // false (6 chars)
  console.log('');
  
  // Ejemplo 6: Info de reglas
  console.log('📌 Ejemplo 6: Información de reglas\n');
  const info = getRulesInfo();
  console.log('   Version:', info.version);
  console.log('   Correction:', info.correctionVersion);
  console.log('   Total Rules:', info.totalRules);
  console.log('   Total Combinations:', info.totalCombinations);
  console.log('   Protected:', info.protected);
  console.log('   Frozen:', info.frozen);
  console.log('   Families:', info.availableFamilies.join(', '));
  console.log('');
  
  console.log('='.repeat(70));
  console.log('✅ Todos los ejemplos ejecutados correctamente');
  console.log('='.repeat(70) + '\n');
}

// Ejecutar ejemplo si se corre directamente
if (require.main === module) {
  example();
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Funciones principales
  generateSKU,
  generateMultipleSKUs,
  validateSKU,
  getRulesInfo,
  
  // Funciones auxiliares (útiles para debugging)
  extractNumbers,
  getLast4Digits,
  getPrefix,
  
  // NO exportar las reglas directamente por seguridad
  // Para acceder a reglas, usar: rulesProtection.getProtectedRules()
};
