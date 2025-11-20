// ============================================================================
// ELIMFILTERS — DUTY CLASSIFIER v4.0
// Clasifica el duty: HD (Heavy Duty) o LD (Light Duty).
// ============================================================================

const OEM_HD = [
    "CATERPILLAR", "CAT",
    "KOMATSU",
    "JOHN DEERE",
    "VOLVO CE", "VOLVO CONSTRUCTION", "VOLVO",
    "KUBOTA",
    "HITACHI",
    "CASE", "CNH", "NEW HOLLAND",
    "ISUZU",
    "HINO",
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

const OEM_LD = [
    "TOYOTA",
    "NISSAN",
    "HONDA",
    "MAZDA",
    "MITSUBISHI",
    "KIA",
    "HYUNDAI",
    "FORD",
    "CHEVROLET",
    "SUZUKI",
    "SUBARU",
    "VW",
    "VOLKSWAGEN",
    "AUDI",
    "BMW"
];

function classifyDuty(oemBrand, fallbackManufacturer = null) {
    if (!oemBrand) return "HD";

    const brand = oemBrand.toUpperCase().trim();

    if (OEM_HD.includes(brand)) return "HD";
    if (OEM_LD.includes(brand)) return "LD";

    if (fallbackManufacturer) {
        const mf = fallbackManufacturer.toUpperCase();
        if (mf === "DONALDSON") return "HD";
        if (mf === "FRAM") return "LD";
    }

    return "HD";
}

module.exports = {
    classifyDuty
};
