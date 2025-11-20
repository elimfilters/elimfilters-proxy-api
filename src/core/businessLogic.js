// ============================================================================
// ELIMFILTERS — BUSINESS LOGIC ENGINE v4.0
// Lógica oficial para generar SKU único o múltiples SKU según equivalencias.
// ============================================================================

const rules = require("./rulesProtection");
const homologationDB = require("./homologationDB");
const jsonBuilder = require("../utils/jsonBuilder");

// Detecta si una marca es OEM o CROSS
function classifyBrand(brand) {
    if (rules.isOEM(brand)) return "OEM";
    if (rules.isCross(brand)) return "CROSS";
    return "UNKNOWN";
}

// Normalización de código
function normalize(code) {
    return code.trim().toUpperCase().replace(/\s+/g, "");
}

// ============================================================================
// REGLA BASE — Extraer los últimos 4 dígitos
// ============================================================================
function extractLast4(code) {
    const digits = code.replace(/\D+/g, "");
    return digits.slice(-4);
}

// ============================================================================
// GENERADOR PRINCIPAL DE UN SKU
// ============================================================================
function generateSingleSKU({ duty, family, baseCode }) {
    const prefix = rules.getPrefix(family, duty);
    if (!prefix) throw new Error("PREFIX_NOT_DEFINED_FOR_FAMILY_DUTY");

    const last4 = extractLast4(baseCode);
    return rules.validateNewSKU(prefix, last4);
}

// ============================================================================
// MULTI-SKU ENGINE
// ============================================================================
// Aquí se generan TODOS los SKU cuando hay múltiples Donaldson/Fram equivalentes.
function generateMultipleSKUs(oemCode, duty, family, refList) {
    const prefix = rules.getPrefix(family, duty);
    if (!prefix) throw new Error("PREFIX_NOT_DEFINED");

    const list = [];

    for (let ref of refList.slice(0, 10)) {
        const last4 = extractLast4(ref);
        const sku = rules.validateNewSKU(prefix, last4);

        list.push({
            sku,
            last4_source: ref,
            primary: false
        });
    }

    // Marcar el PRIMARIO (primer equivalente)
    if (list.length > 0) list[0].primary = true;

    // Guardar auditoría
    homologationDB.saveMultiEquivalence(oemCode, list);

    return list;
}

// ============================================================================
// LÓGICA COMPLETA DEL MOTOR DE SKU
// ============================================================================
function buildSKU(oemCode, brand, duty, family, equivalents) {
    const cleanBrand = brand.toUpperCase();
    const type = classifyBrand(cleanBrand);

    const normalizedOEM = normalize(oemCode);

    // Si es OEM, prioridad absoluta: usar Donaldson/Fram
    if (type === "OEM") {
        if (equivalents.length === 0) {
            // No existe en Donaldson/Fram → usar propios 4 dígitos OEM
            const sku = generateSingleSKU({
                duty,
                family,
                baseCode: normalizedOEM
            });
            return { primary: sku, list: [sku], multi: false };
        }

        // Si hay muchos equivalentes → multi-SKU
        if (equivalents.length > 1) {
            const list = generateMultipleSKUs(normalizedOEM, duty, family, equivalents);
            return {
                primary: list[0].sku,
                list: list.map(e => e.sku),
                multi: true
            };
        }

        // Solo 1 equivalente → SKU único
        const single = generateSingleSKU({
            duty,
            family,
            baseCode: equivalents[0]
        });
        return { primary: single, list: [single], multi: false };
    }

    // Si es CROSS / Aftermarket
    if (type === "CROSS") {
        // Donaldson o Fram es lo que define el SKU final
        if (equivalents.length > 0) {
            const sku = generateSingleSKU({
                duty,
                family,
                baseCode: equivalents[0]
            });
            return { primary: sku, list: [sku], multi: false };
        }

        // No hay equivalentes → usar OEM más comercial
        const sku = generateSingleSKU({
            duty,
            family,
            baseCode: normalizedOEM
        });
        return { primary: sku, list: [sku], multi: false };
    }

    // Si es UNKNOWN → registrar para homologación
    homologationDB.saveUnknownCode(normalizedOEM);

    const fallback = generateSingleSKU({
        duty,
        family,
        baseCode: normalizedOEM
    });

    return { primary: fallback, list: [fallback], multi: false };
}

module.exports = {
    buildSKU
};
