// ============================================================================
// ELIMFILTERS — RULES PROTECTION v3.0
// Asegura que NO existan SKUs duplicados + valida consistencia del motor.
// Este archivo protege la integridad del sistema antes de registrar un SKU.
// ============================================================================

/**
 * Verifica que el SKU no exista previamente en la base de datos.
 *
 * @param {string} sku - SKU generado
 * @param {object[]} db - Base de datos completa (array de registros)
 * @returns {{valid: boolean, reason?: string}}
 */
function validateUniqueSKU(sku, db) {
    const exists = db.some(r => r.sku === sku);

    if (exists) {
        return {
            valid: false,
            reason: `SKU_DUPLICATED: El SKU '${sku}' ya existe en base de datos.`
        };
    }

    return { valid: true };
}

/**
 * Valida que exista familia, duty y prefijo correcto
 */
function validateStructuralFields(record) {
    const required = ["family", "duty", "prefix"];

    for (const field of required) {
        if (!record[field] || record[field].trim() === "") {
            return {
                valid: false,
                reason: `INVALID_STRUCTURE: Falta el campo requerido '${field}'.`
            };
        }
    }

    return { valid: true };
}

/**
 * Protección para equivalencias múltiples:
 * Confirma que la generación múltiple contenga información mínima válida.
 */
function validateMultiEquivalence(list) {
    if (!Array.isArray(list) || list.length === 0) {
        return {
            valid: false,
            reason: "INVALID_MULTI_EQUIVALENCE: La lista está vacía."
        };
    }

    const invalid = list.some(item =>
        !item.sku ||
        !item.prefix ||
        !item.last4 ||
        !item.family ||
        !item.duty
    );

    if (invalid) {
        return {
            valid: false,
            reason: "INVALID_MULTI_EQUIVALENCE: Estructura incompleta."
        };
    }

    return { valid: true };
}

module.exports = {
    validateUniqueSKU,
    validateStructuralFields,
    validateMultiEquivalence
};
