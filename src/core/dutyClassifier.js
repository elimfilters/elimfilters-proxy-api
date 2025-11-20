// ============================================================================
// ELIMFILTERS — DUTY CLASSIFIER v4.0
// Clasifica un código OEM/CROSS como HD o LD según reglas oficiales.
// ============================================================================

const OEM_HD = [
    "CATERPILLAR", "KOMATSU", "JOHN DEERE", "VOLVO CE", "CASE",
    "NEW HOLLAND", "CNH", "HITACHI", "KUBOTA", "ISUZU",
    "HINO", "YANMAR", "MITSUBISHI FUSO", "SCANIA", "DOOSAN",
    "PERKINS", "MACK", "MAN", "RENAULT", "DEUTZ",
    "DETROIT DIESEL", "INTERNATIONAL", "NAVISTAR"
];

const OEM_LD = [
    "TOYOTA", "NISSAN", "VOLVO TRUCKS", "FORD", "MERCEDES-BENZ"
];

function classifyDuty(brand) {
    if (!brand) return "HD"; // Default conservador

    const upper = brand.trim().toUpperCase();

    if (OEM_HD.includes(upper)) return "HD";
    if (OEM_LD.includes(upper)) return "LD";

    // Si no está explícito, evaluar por heurística:
    if (upper.includes("TRUCK") || upper.includes("ENGINE")) return "HD";
    if (upper.includes("AUTO") || upper.includes("CAR")) return "LD";

    // Default
    return "HD";
}

module.exports = {
    classifyDuty
};
