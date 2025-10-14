// businessLogic.js (NODO 4: Reglas Críticas de ELIMFILTERS)

// --- TABLA DE PREFIJOS DEFINITIVA (NODO 4) ---
const ELIMFILTERS_PREFIXES_FINAL = {
    'ACEITE': 'EL8',   
    'AIRE': 'EA1',  
    'COMBUSTIBLE': 'EF9',
    'HIDRÁULICO': 'EH6',
    'CABINA': 'EC1',
    'SEPARADOR COMBUSTIBLE': 'ES9',
    'REFRIGERANTE': 'EW7',
    'SECADOR DE AIRE': 'ED4',
    'TRANSMISIÓN': 'ET3',
    'KITS HD': 'EK5',
    'KITS LD': 'EK7',
    'TURBINAS/CARTUCHOS': 'EF2',
    'CARCASAS DE AIRE': 'EB2',
};

// Umbrales de ejemplo para la determinación de Duty (Ajustar según datos reales)
const HD_OIL_DIAMETER_MIN = 95; // mm
const HD_OIL_CAPACITY_MIN = 35; // gramos

// Función auxiliar para encontrar la referencia por la que vamos a homologar
function findReferenceByPrefix(refs, prefixes) {
    for (const ref of refs) {
        // Asumimos que la referencia cruzada comienza con la clave de la marca
        if (prefixes.some(p => ref.toUpperCase().startsWith(p))) {
            return ref;
        }
    }
    return null;
}

/**
 * 1. NODO 4: Obtención del Prefijo
 */
function getElimfiltersPrefix(family) {
    const key = family.toUpperCase().replace(/\s/g, '_'); // Normaliza nombres con espacios
    const prefix = ELIMFILTERS_PREFIXES_FINAL[key]; 
    if (!prefix) {
        throw { 
            errorCode: "DATA_UNCERTAINTY", 
            message: `Familia de filtro '${family}' no tiene prefijo definido.`,
            status: 500 
        };
    }
    return prefix;
}

/**
 * 2. NODO 4: Lógica de Determinación de Duty Level (HD/LD)
 */
function determineDutyLevel(family, specs, oemCodes, crossReference) {
    // A. INFERENCIA DIRECTA (Para familias solo HD/LD)
    if (['ES9', 'EW7', 'ED4', 'EK5', 'EB2', 'EF2'].some(p => ELIMFILTERS_PREFIXES_FINAL[family] === p)) {
        return 'HD'; // Estas familias son por definición Heavy Duty
    }
    if (ELIMFILTERS_PREFIXES_FINAL[family] === 'EK7') {
        return 'LD';
    }

    // B. INFERENCIA POR ESPECIFICACIONES (Para familias mixtas: OIL, AIR, FUEL, etc.)
    const od = parseFloat(specs["Outer Diameter (mm)"]);
    const dirtCapacity = parseFloat(specs["Dirt Capacity (g)"]);

    // Lógica HD para Filtros Líquidos (OIL, HIDRÁULICO, etc.)
    if (family === 'ACEITE' || family === 'HIDRÁULICO') {
        if (od >= HD_OIL_DIAMETER_MIN || dirtCapacity >= HD_OIL_CAPACITY_MIN) {
            return 'HD';
        }
        // Si no cumple el umbral HD, se clasifica como LD
        return 'LD';
    }

    // C. FALLBACK: Si es AIR/CABIN y no hay regla específica por specs, se necesita analizar códigos
    // Si la referencia principal del NODO 3 es un OEM muy grande, asumir HD
    if (oemCodes.some(c => c.toUpperCase().startsWith('CATERPILLAR') || c.toUpperCase().startsWith('CUMMINS'))) {
        return 'HD';
    }

    // Asumir LD si no hay una prueba contundente de HD (En caso de duda en las familias mixtas)
    return 'LD';
}


/**
 * 3. NODO 4: Lógica de Código Base (Donaldson/FRAM/OEM)
 */
function applyBaseCodeLogic(duty, family, oemCodes, crossReference) {
    const allReferences = [...oemCodes, ...crossReference];
    let targetBrandCode = null;
    let targetBrand = '';

    if (duty === 'HD') {
        // PRIORIDAD HD: 1. Donaldson (P)
        targetBrandCode = findReferenceByPrefix(allReferences, ['P']); 
        targetBrand = 'Donaldson';

        if (!targetBrandCode) {
            // FALLBACK HD: Usar el primer OEM code disponible (se asume que es el más comercial)
            targetBrandCode = oemCodes[0] || null;
            targetBrand = 'OEM';
        }
    } else { // duty === 'LD'
        // PRIORIDAD LD: 1. FRAM (PH, CH)
        targetBrandCode = findReferenceByPrefix(allReferences, ['PH', 'CH', 'CA']); // FRAM o común LD
        targetBrand = 'FRAM';

        if (!targetBrandCode) {
            // FALLBACK LD: Usar el primer OEM code disponible
            targetBrandCode = oemCodes[0] || null;
            targetBrand = 'OEM';
        }
    }

    if (!targetBrandCode) {
        // Error de datos: Fallo en la Regla de Código Base
        throw { 
            errorCode: "DATA_UNCERTAINTY", 
            message: `No se pudo obtener el código base para Duty=${duty}.`,
            status: 500 
        };
    }
    
    // Extraer los últimos 4 dígitos numéricos
    const numericCode = targetBrandCode.replace(/[^0-9]/g, '');
    const baseCode = numericCode.slice(-4);

    return { baseCode, baseCodeSource: targetBrand };
}

module.exports = {
    getElimfiltersPrefix,
    determineDutyLevel,
    applyBaseCodeLogic
};
