// rulesProtection.js - v2.2.4 (ACTUALIZADO y CORREGIDO)
// Protección de reglas oficiales ELIMFILTERS

// ============================================================================
// TABLA OFICIAL DE REGLAS (inmutable)
// ============================================================================

const PROTECTED_RULES = Object.freeze({

  version: "2.2.4",
  correctionVersion: "EK5_EK6_ADDED",
  lastUpdate: new Date().toISOString(),

  rules: Object.freeze({
    "OIL|HD": "EL8",
    "OIL|LD": "EL8",

    "FUEL|HD": "EF9",
    "FUEL|LD": "EF9",

    "AIR|HD": "EA1",
    "AIR|LD": "EA1",

    "CABIN|HD": "EC1",
    "CABIN|LD": "EC1",

    "FUEL SEPARATOR|HD": "ES9",

    "AIR DRYER|HD": "ED4",

    "HYDRAULIC|HD": "EH6",

    "COOLANT|HD": "EW7",

    "CARCAZA|HD": "EA2",

    "TURBINE|HD": "ET9",

    // NUEVOS PREFIJOS
    "KITS HD|HD": "EK5",
    "KITS LD|LD": "EK6"
  }),

  decisionTable: Object.freeze({
    "OIL|HD": true,
    "OIL|LD": true,
    "FUEL|HD": true,
    "FUEL|LD": true,
    "AIR|HD": true,
    "AIR|LD": true,
    "CABIN|HD": true,
    "CABIN|LD": true,
    "FUEL SEPARATOR|HD": true,
    "AIR DRYER|HD": true,
    "HYDRAULIC|HD": true,
    "COOLANT|HD": true,
    "CARCAZA|HD": true,
    "TURBINE|HD": true,
    "KITS HD|HD": true,
    "KITS LD|LD": true
  })
});

// ============================================================================
// VALIDACIONES Y PROTECCIÓN
// ============================================================================

function validateRulesNotAltered(currentRules) {
  if (!Object.isFrozen(currentRules)) {
    throw new Error("❌ Protected rules have been modified or are not frozen!");
  }

  if (Object.keys(currentRules.rules).length !== 16) {
    throw new Error("❌ Number of protected rules altered!");
  }

  if (!("KITS LD|LD" in currentRules.rules)) {
    throw new Error("❌ Missing EK6 rule for KITS LD!");
  }

  if (!("KITS HD|HD" in currentRules.rules)) {
    throw new Error("❌ Missing EK5 rule for KITS HD!");
  }

  return true;
}

function getPrefix(family, duty) {
  const key = `${family}|${duty}`;
  return PROTECTED_RULES.rules[key] || null;
}

function getProtectedRules() {
  return PROTECTED_RULES;
}

function isValidPrefix(prefix) {
  return Object.values(PROTECTED_RULES.rules).includes(prefix);
}

function getAvailableCombinations() {
  return Object.keys(PROTECTED_RULES.rules);
}

module.exports = {
  getPrefix,
  getProtectedRules,
  validateRulesNotAltered,
  isValidPrefix,
  getAvailableCombinations
};
