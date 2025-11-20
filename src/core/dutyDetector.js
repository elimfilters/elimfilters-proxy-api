// ============================================================================
// ELIMFILTERS — DUTY DETECTOR v4.0
// Determina si un código pertenece a HD (Heavy Duty) o LD (Light Duty)
// siguiendo las reglas oficiales del sistema ELIMFILTERS.
// ============================================================================

/**
 * OEM pesados (HD)
 * Regla: Si el fabricante está en esta lista → HD.
 */
const OEM_HD = [
    "CATERPILLAR", "CAT",
    "KOMATSU",
    "JOHN DEERE",
    "VOLVO CE",
    "VOLVO TRUCKS",
    "KUBOTA",
    "HITACHI",
    "CASE", "CNH", "NEW HOLLAND",
    "ISUZU", "HINO",
    "YANMAR",
    "MITSUBISHI FUSO",
    "HYUNDAI CONSTRUCTION",
    "SCANIA",
    "MERCEDES-BENZ",
    "CUMMINS",
    "PERKINS",
    "DOOSAN",
    "MACK",
    "MAN",
    "RENAULT TRUCKS",
    "DEUTZ",
    "DETROIT DIESEL",
    "INTERNATIONAL", "NAVISTAR"
];

/**
 * OEM automotrices (LD)
 */
const OEM_LD = [
    "TOYOTA",
    "NISSAN",
    "KIA",
    "HYUNDAI",
    "HONDA",
    "FORD",
    "CHEVROLET",
    "SUZUKI",
    "MITSUBISHI",
    "SUBARU"
];

/**
 * Determinar duty según fabricante OEM
 */
function detectByOEM(brand) {
    const b = String(brand || "").toUpperCase().trim();

    if (!b) return null;

    if (OEM_HD.includes(b)) return "HD";
    if (OEM_LD.includes(b)) return "LD";

    return null;
}

/**
 * Duty según fabricante aftermarket:
 * Donaldson = HD
 * FRAM = LD
 */
function detectByAftermarket(brand) {
    const b = String(brand || "").toUpperCase().trim();

    if (b === "DONALDSON") return "HD";
    if (b === "FRAM") return "LD";

    return null;
}

/**
 * Regla final:
 * 1. OEM → HD/LD
 * 2. Aftermarket → HD/LD
 * 3. Si no hay evidencia → HD (definido por Elimfilters)
 */
function detectDuty(brand) {
    const oemDuty = detectByOEM(brand);
    if (oemDuty) return oemDuty;

    const aftDuty = detectByAftermarket(brand);
    if (aftDuty) return aftDuty;

    return "HD";
}

module.exports = {
    detectDuty
};
