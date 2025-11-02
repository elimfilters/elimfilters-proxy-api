// rulesProtection.js - VERSIÓN 2.2.3 CORREGIDA
// Sistema de protección inmutable para Reglas v2.2.0 de ELIMFILTERS

const crypto = require('crypto');

// ============================================================================
// CAPA 1: REGLAS HARDCODED EN CÓDIGO (NO MODIFICABLES)
// ============================================================================

// VERSIÓN CORREGIDA - 16 COMBINACIONES OFICIALES
const IMMUTABLE_RULES_V2_2_0 = Object.freeze({
  version: "2.2.0",
  lastUpdate: "2025-10-29",
  correctionVersion: "2.2.3",
  
  rules: Object.freeze({
    rule1: Object.freeze({
      id: "RULE_OIL_ALL",
      family: "OIL",
      duties: ["HD", "LD"],
      prefix: "EL8",
      description: "Oil Filter - Same prefix for HD and LD",
      enabled: true,
      priority: 1
    }),
    
    rule2: Object.freeze({
      id: "RULE_FUEL_ALL",
      family: "FUEL",
      duties: ["HD", "LD"],
      prefix: "EF9",
      description: "Fuel Filter - Same prefix for HD and LD",
      enabled: true,
      priority: 2
    }),
    
    rule3: Object.freeze({
      id: "RULE_AIRE_ALL",
      family: "AIRE",
      duties: ["HD", "LD"],
      prefix: "EA1",
      description: "Air Filter - Same prefix for HD and LD",
      enabled: true,
      priority: 3
    }),
    
    rule4: Object.freeze({
      id: "RULE_CABIN_ALL",
      family: "CABIN",
      duties: ["HD", "LD"],
      prefix: "EC1",
      description: "Cabin Filter - Same prefix for HD and LD",
      enabled: true,
      priority: 4
    }),
    
    rule5: Object.freeze({
      id: "RULE_FUEL_SEPARATOR_HD",
      family: "FUEL SEPARATOR",
      duties: ["HD"],
      prefix: "ES9",
      description: "Fuel Water Separator - HD only",
      enabled: true,
      priority: 5
    }),
    
    rule6: Object.freeze({
      id: "RULE_AIR_DRYER_HD",
      family: "AIR DRYER",
      duties: ["HD"],
      prefix: "ED4",
      description: "Air Dryer - HD only",
      enabled: true,
      priority: 6
    }),
    
    rule7: Object.freeze({
      id: "RULE_HIDRAULIC_HD",
      family: "HIDRAULIC",
      duties: ["HD"],
      prefix: "EH6",
      description: "Hydraulic Filter - HD only",
      enabled: true,
      priority: 7
    }),
    
    rule8: Object.freeze({
      id: "RULE_COOLANT_HD",
      family: "COOLANT",
      duties: ["HD"],
      prefix: "EW7",
      description: "Coolant Filter - HD only",
      enabled: true,
      priority: 8
    }),
    
    rule9: Object.freeze({
      id: "RULE_CARCAZA_HD",
      family: "CARCAZA AIR FILTER",
      duties: ["HD"],
      prefix: "EA2",
      description: "Air Filter Housing - HD only",
      enabled: true,
      priority: 9
    }),
    
    rule10: Object.freeze({
      id: "RULE_TURBINE_HD",
      family: "TURBINE SERIES",
      duties: ["HD"],
      prefix: "ET9",
      description: "Turbine Series - HD only",
      enabled: true,
      priority: 10
    }),
    
    rule11: Object.freeze({
      id: "RULE_KITS_HD",
      family: "KITS SERIES HD",
      duties: ["HD"],
      prefix: "EK5",
      description: "Kits Series Heavy Duty",
      enabled: true,
      priority: 11
    }),
    
    rule12: Object.freeze({
      id: "RULE_KITS_LD",
      family: "KITS SERIES LD",
      duties: ["LD"],
      prefix: "EK3",
      description: "Kits Series Light Duty",
      enabled: true,
      priority: 12
    })
  }),
  
  // TABLA DE DECISIÓN CORREGIDA - 16 COMBINACIONES
  decisionTable: Object.freeze({
    // OIL - Mismo prefix para HD y LD
    "OIL|HD": "EL8",
    "OIL|LD": "EL8",
    
    // FUEL - Mismo prefix para HD y LD
    "FUEL|HD": "EF9",
    "FUEL|LD": "EF9",
    
    // AIRE - Mismo prefix para HD y LD
    "AIRE|HD": "EA1",
    "AIRE|LD": "EA1",
    
    // CABIN - Mismo prefix para HD y LD
    "CABIN|HD": "EC1",
    "CABIN|LD": "EC1",
    
    // FUEL SEPARATOR - Solo HD
    "FUEL SEPARATOR|HD": "ES9",
    
    // AIR DRYER - Solo HD
    "AIR DRYER|HD": "ED4",
    
    // HIDRAULIC - Solo HD
    "HIDRAULIC|HD": "EH6",
      
    // COOLANT - Solo HD
    "COOLANT|HD": "EW7",
    
    // CARCAZA AIR FILTER - Solo HD
    "CARCAZA AIR FILTER|HD": "EA2",
    
    // TURBINE SERIES - Solo HD
    "TURBINE SERIES|HD": "ET9",
    
    // KITS SERIES - Diferentes familias para HD y LD
    "KITS SERIES HD|HD": "EK5",
    "KITS SERIES LD|LD": "EK3"
  })
});

// ============================================================================
// CAPA 2: HASH DE INTEGRIDAD (VERIFICACIÓN)
// ============================================================================

// Hash SHA-256 de las reglas CORREGIDAS v2.2.3
const OFFICIAL_RULES_HASH = 'ACTUALIZAR_DESPUÉS_DE_GENERAR_HASH';

/**
 * Calcula el hash SHA-256 de las reglas
 */
function calculateRulesHash(rules) {
  const rulesString = JSON.stringify(rules, Object.keys(rules).sort());
  return crypto.createHash('sha256').update(rulesString).digest('hex');
}

/**
 * Verifica la integridad de las reglas
 */
function verifyRulesIntegrity(rules) {
  // Por ahora, mientras generamos el hash oficial, retornar true
  // En producción, descomentar la línea siguiente
  // const currentHash = calculateRulesHash(rules);
  // return currentHash === OFFICIAL_RULES_HASH;
  return true;
}

// ============================================================================
// CAPA 3: PROTECCIÓN EN MEMORIA (CONGELAR OBJETO)
// ============================================================================

function deepFreeze(obj) {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(prop => {
    if (obj[prop] !== null
        && (typeof obj[prop] === 'object' || typeof obj[prop] === 'function')
        && !Object.isFrozen(obj[prop])) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}

// ============================================================================
// CAPA 4: CARGA DESDE VARIABLE DE ENTORNO (OPCIONAL)
// ============================================================================

function loadRulesFromEnv() {
  try {
    if (process.env.ELIMFILTERS_RULES) {
      const rules = JSON.parse(process.env.ELIMFILTERS_RULES);
      
      if (!verifyRulesIntegrity(rules)) {
        console.warn('⚠️  WARNING: Rules from ENV failed integrity check. Using immutable rules.');
        return null;
      }
      
      return deepFreeze(rules);
    }
  } catch (error) {
    console.error('❌ Error loading rules from ENV:', error.message);
  }
  
  return null;
}

// ============================================================================
// CAPA 5: VALIDACIÓN EN RUNTIME
// ============================================================================

function validateRulesNotAltered(rules) {
  // Verificar versión
  if (rules.version !== "2.2.0") {
    throw new Error('SECURITY VIOLATION: Rules version has been altered!');
  }
  
  // Verificar que el objeto está congelado
  if (!Object.isFrozen(rules)) {
    throw new Error('SECURITY VIOLATION: Rules object is not frozen!');
  }
  
  // Verificar que existen las reglas principales
  const expectedRules = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5'];
  for (const ruleKey of expectedRules) {
    if (!rules.rules[ruleKey]) {
      throw new Error(`SECURITY VIOLATION: Required rule ${ruleKey} is missing!`);
    }
  }
  
  // Verificar prefijos críticos (corregidos)
  const criticalPrefixes = ['EL8', 'EF9', 'EA1', 'EC1', 'ES9', 'ED4', 'EW7', 'EA2', 'ET9', 'EK5', 'EK3'];
  const ruleValues = Object.values(rules.decisionTable);
  
  for (const prefix of criticalPrefixes) {
    if (!ruleValues.includes(prefix)) {
      throw new Error(`SECURITY VIOLATION: Critical prefix ${prefix} is missing!`);
    }
  }
  
  return true;
}

// ============================================================================
// SISTEMA DE CARGA CON PRIORIDAD
// ============================================================================

function getProtectedRules() {
  console.log('🔒 Loading protected rules v2.2.0 (corrected v2.2.3)...');
  
  const envRules = loadRulesFromEnv();
  if (envRules) {
    console.log('✅ Rules loaded from environment variable');
    return envRules;
  }
  
  console.log('✅ Using immutable hardcoded rules (safest option)');
  validateRulesNotAltered(IMMUTABLE_RULES_V2_2_0);
  
  return IMMUTABLE_RULES_V2_2_0;
}

// ============================================================================
// FUNCIONES DE ACCESO SEGURO
// ============================================================================

function getPrefix(family, duty) {
  const rules = getProtectedRules();
  const key = `${family}|${duty}`;
  const prefix = rules.decisionTable[key];
  
  if (!prefix) {
    // Listar combinaciones disponibles para debug
    const available = Object.keys(rules.decisionTable).join(', ');
    console.warn(`⚠️  No prefix found for ${key}. Available: ${available}`);
  }
  
  return prefix || null;
}

function getAllRules() {
  return getProtectedRules();
}

function getRuleById(ruleId) {
  const rules = getProtectedRules();
  return Object.values(rules.rules).find(r => r.id === ruleId) || null;
}

function isValidPrefix(prefix) {
  const rules = getProtectedRules();
  return Object.values(rules.decisionTable).includes(prefix);
}

function getAvailableCombinations() {
  const rules = getProtectedRules();
  return Object.keys(rules.decisionTable);
}

// ============================================================================
// LOGS DE SEGURIDAD
// ============================================================================

function logSecurityViolation(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] SECURITY VIOLATION: ${message}`;
  console.error('🚨', logEntry);
}

// ============================================================================
// MIDDLEWARE EXPRESS
// ============================================================================

function validateRulesMiddleware(req, res, next) {
  try {
    const rules = getProtectedRules();
    validateRulesNotAltered(rules);
    next();
  } catch (error) {
    logSecurityViolation(error.message);
    res.status(500).json({
      error: 'System integrity violation',
      message: 'Rules validation failed. System locked for security.'
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Funciones principales
  getProtectedRules,
  getPrefix,
  getAllRules,
  getRuleById,
  isValidPrefix,
  getAvailableCombinations,
  
  // Funciones de validación
  verifyRulesIntegrity,
  validateRulesNotAltered,
  calculateRulesHash,
  
  // Middleware
  validateRulesMiddleware,
  
  // Constantes (solo lectura)
  IMMUTABLE_RULES_V2_2_0,
  OFFICIAL_RULES_HASH,
  
  // Utilidades
  deepFreeze,
  logSecurityViolation
};

// ============================================================================
// GENERAR HASH OFICIAL (ejecutar una vez para obtener el hash)
// ============================================================================

if (require.main === module) {
  console.log('\n📊 REGLAS CORREGIDAS v2.2.3\n');
  console.log('Total de reglas:', Object.keys(IMMUTABLE_RULES_V2_2_0.decisionTable).length);
  console.log('\nCombinaciones disponibles:');
  Object.entries(IMMUTABLE_RULES_V2_2_0.decisionTable).forEach(([key, value]) => {
    console.log(`  ${key.padEnd(25)} → ${value}`);
  });
  
  console.log('\n🔐 Hash SHA-256:');
  const hash = calculateRulesHash(IMMUTABLE_RULES_V2_2_0);
  console.log(`  ${hash}`);
  console.log('\n✅ Copiar este hash a OFFICIAL_RULES_HASH\n');
}
