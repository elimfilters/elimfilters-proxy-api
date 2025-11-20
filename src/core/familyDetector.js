// ============================================================================
// ELIMFILTERS — FAMILY DETECTOR v4.0
// Detecta familia del filtro a partir del código OEM/CROSS
// Usa heurísticas limpias y compatibles con tus reglas oficiales.
// ============================================================================

/**
 * Tabla de palabras clave por familia.
 * Se pueden ampliar sin afectar la lógica.
 */
const FAMILY_KEYWORDS = {
    AIR: ["AIR", "AIRE", "AF", "ELEMENT AIR", "AIR CLEANER"],
    OIL: ["OIL", "LUBE", "LUBRICACION", "ENGINE OIL", "FULL FLOW"],
    FUEL: ["FUEL", "GAS", "DIESEL", "FF", "FUEL FILTER"],
    HYDRAULIC: ["HYD", "HYDRAULIC", "HIDRAULICO"],
    CABIN: ["CABIN", "A/C", "CABIN AIR", "POLLEN"],
    CARCAZAS: ["HOUSING", "CARCAZA", "AIR FILTER HOUSING"],
    AIR_DRYER: ["DRYER", "AIR DRYER", "AD-"],
    COOLANT: ["COOLANT", "ANTIFREEZE", "WATER FILTER"],
    FUEL_SEPARATOR: ["SEPARATOR", "SEPARADOR", "FUEL WATER SEPARATOR"],
    KITS_HD: ["KIT", "SERVICE KIT", "MAINTENANCE KIT"],
    KITS_LD: ["KIT", "SET", "FILTER SET"]
};

/**
 * Detección por palabra clave.
 */
function detectByKeywords(text) {
    const t = String(text || "").toUpperCase();

    for (const fam in FAMILY_KEYWORDS) {
        const keys = FAMILY_KEYWORDS[fam];
        if (keys.some(k => t.includes(k))) {
            return fam;
        }
    }

    return null;
}

/**
 * Detección basada en código OEM/CROSS.
 * NO asigna familia por marca, solo pistas reales.
 */
function detectByCodePattern(code) {
    const c = String(code || "").toUpperCase();

    if (/^P[0-9]{5,6}$/.test(c)) return "FUEL";   // Donaldson fuel/logistics
    if (/^1R[- ]?/.test(c)) return "OIL";         // CAT 1R-xxxx son oil

    return null;
}

/**
 * Función principal: detecta familia con 3 niveles:
 * 1. Keywords explícitos
 * 2. Patrón del código
 * 3. Fallback → OIL (según tus reglas)
 */
function detectFamily(oemCode, description = "") {
    const t1 = detectByKeywords(description);
    if (t1) return t1;

    const t2 = detectByCodePattern(oemCode);
    if (t2) return t2;

    // Fallback seguro
    return "OIL";
}

module.exports = {
    detectFamily
};
