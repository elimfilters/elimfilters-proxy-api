// ============================================================================
// ELIMFILTERS — FILTER PROCESSOR V4.0
// Motor principal encargado de generar SKUs, multi-equivalentes y datos limpios
// ============================================================================

const detectionService = require("../services/detectionService");
const dataAccess = require("../services/dataAccess");
const rules = require("../core/businessLogic");
const jsonBuilder = require("../utils/jsonBuilder");

// ============================================================================
// PREFIJOS OFICIALES DEFINIDOS POR ELIMFILTERS
// ============================================================================

const DUTY_PREFIX = {
    AIR: { HD: "EA1", LD: "EA1" },
    OIL: { HD: "EL8", LD: "EL8" },
    FUEL: { HD: "EF9", LD: "EF9" },
    HYDRAULIC: { HD: "EH6", LD: null },
    CABIN: { HD: "EC1", LD: "EC1" },
    AIR_DRYER: { HD: "ED4", LD: null },
    COOLANT: { HD: "EW7", LD: null },
    FUEL_SEPARATOR: { HD: "ES9", LD: null },
    CARCAZAS: { HD: "EA2", LD: null },
    KITS_HD: { HD: "EK5", LD: null },
    KITS_LD: { HD: null, LD: "EK6" }
};

// ============================================================================
// MEDIA TYPES OFICIALES
// ============================================================================
function resolveMediaType(family) {
    switch (family) {
        case "AIR":
            return "Macrocore";
        case "CABIN":
            return "Microkappa";
        default:
            return "Elimtek";
    }
}

// ============================================================================
// OEM LISTA OFICIAL
// ============================================================================
const OEM_BRANDS = [
    "CATERPILLAR", "KOMATSU", "TOYOTA", "NISSAN", "JOHN DEERE", "FORD",
    "VOLVO", "KUBOTA", "HITACHI", "CASE", "ISUZU", "HINO", "YANMAR",
    "MITSUBISHI", "HYUNDAI", "SCANIA", "MERCEDES", "CUMMINS", "PERKINS",
    "DOOSAN", "MACK", "MAN", "RENAULT", "DEUTZ", "DETROIT", "INTERNATIONAL"
];

// ============================================================================
// AFTERMARKET LISTA OFICIAL
// ============================================================================

const AFTERMARKET_BRANDS = [
    "DONALDSON", "FLEETGUARD", "PARKER", "RACOR", "BALDWIN",
    "MANN", "WIX", "FRAM", "HENGST", "MAHLE", "SAKURA",
    "LUBER-FINER", "SURE FILTERS", "TECFIL", "BOSCH", "PREMIUM FILTERS"
];

// ============================================================================
// NORMALIZA CADENA
// ============================================================================
function normalize(str) {
    return (str || "").toUpperCase().trim();
}

// ============================================================================
// CREAR SKU DESDE EQUIVALENTES
// ============================================================================
function buildSKU(prefix, base) {
    return `${prefix}${base.padStart(4, "0")}`;
}

// ============================================================================
// AGRUPA EQUIPMENT POR FABRICANTE
// ============================================================================
function groupEquipment(equipmentList) {
    if (!Array.isArray(equipmentList) || equipmentList.length === 0) return [];

    const map = {};

    equipmentList.forEach(item => {
        if (!item || !item.model) return;
        const brand = normalize(item.brand);
        if (!map[brand]) map[brand] = [];
        map[brand].push(item.model);
    });

    const result = [];
    for (const brand in map) {
        result.push(`${brand}: ${map[brand].join(", ")}`);
    }

    return result;
}

// ============================================================================
// PROCESAMIENTO PRINCIPAL
// ============================================================================
async function processFilterCode(code) {
    const input = normalize(code);

    // 1. Consultar equivalentes
    const matches = await dataAccess.queryByOEMOrCross(input);
    if (!matches || matches.length === 0) {
        throw { status: 404, message: "CODE_NOT_FOUND" };
    }

    // Determinar si el input pertenece a OEM o Aftermarket
    const isOEM = OEM_BRANDS.some(b =>
        matches.some(m => m.brand && normalize(m.brand).includes(b))
    );

    // Familia / Duty se toma del equivalente primario
    const primary = matches[0];
    const family = normalize(primary.family);
    const duty = normalize(primary.duty);

    const prefix = DUTY_PREFIX[family] && DUTY_PREFIX[family][duty];
    if (!prefix) {
        return jsonBuilder.buildErrorResponse({
            query_norm: input,
            error: "INVALID_PREFIX",
            ok: false
        });
    }

    // =====================================================================
    // GENERAR BASES PARA CADA EQUIVALENTE
    // =====================================================================

    const skuList = matches.map(m => {
        let last4;

        // Regla HD
        if (duty === "HD") {
            // Donaldson si lo fabrica
            if (m.cross_brand === "DONALDSON" && m.cross_part_number) {
                last4 = m.cross_part_number.slice(-4);
            } else {
                // OEM si Donaldson no lo fabrica
                last4 = input.slice(-4);
            }
        }

        // Regla LD
        else if (duty === "LD") {
            // FRAM si lo fabrica
            if (m.cross_brand === "FRAM" && m.cross_part_number) {
                last4 = m.cross_part_number.slice(-4);
            } else {
                // OEM si FRAM no lo fabrica
                last4 = input.slice(-4);
            }
        }

        return {
            base: last4,
            sku: buildSKU(prefix, last4),
            brand: m.cross_brand,
            part: m.cross_part_number,
            isPrimary: false
        };
    });

    // ORDENAR y marcar PRIMARIO (el de menor número)
    skuList.sort((a, b) => Number(a.base) - Number(b.base));
    skuList[0].isPrimary = true;

    const finalSKU = skuList[0].sku;

    // =====================================================================
    // GENERAR RESPUESTA FINAL
    // =====================================================================

    return jsonBuilder.buildStandardResponse({
        queryNorm: input,
        sku: finalSKU,
        duty,
        family,
        mediaType: resolveMediaType(family),
        oemCodes: [...new Set(matches.map(m => m.oem_code).filter(Boolean))],
        crossReference: skuList.map(s => ({
            brand: s.brand,
            part: s.part,
            sku: s.sku,
            primary: s.isPrimary
        })),
        engineApplications: [...new Set(matches.flatMap(m => m.engine_app || []))],
        equipmentApplications: groupEquipment(matches.flatMap(m => m.equipment_app || [])),
        specs: primary.specs || {},
        priority_reference: finalSKU,
        ok: true
    });
}

// ============================================================================
// EXPORT
// ============================================================================
module.exports = { processFilterCode };
