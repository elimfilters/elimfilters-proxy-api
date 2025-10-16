// homologationDB.js

/**
 * ESTA TABLA SIMULA EL ÍNDICE DE BÚSQUEDA RÁPIDA:
 * Mapea CUALQUIER código de entrada (LF3620, 33166) a un ID de diseño maestro.
 */
const REFERENCE_INDEX = {
    // Código WIX 33166 y sus homólogos apuntan al Master Design D-F003
    "33166": "D-F003-FUEL",
    "FF5507": "D-F003-FUEL",
    "P556245": "D-F003-FUEL", // El código Donaldson también apunta al mismo diseño
    
    // Ejemplo de un filtro de aceite para asegurar el blindaje
    "LF3000": "D-F001-OIL",
    "P552100": "D-F001-OIL"
};


/**
 * ESTA TABLA CONTIENE EL REGISTRO MAESTRO DE ESPECIFICACIONES (La Fuente de la Verdad).
 * La clave es el ID de diseño físico único.
 */
const MASTER_DESIGN_DATA = {
    // Diseño 1: Filtro de Aceite (Ejemplo de LF3000 / P552100)
    "D-F001-OIL": {
        filter_family: "ACEITE",
        duty_level: "HD",
        priority_reference: "P552100", // La referencia que el NODO 4 DEBE usar para el SKU
        priority_brand: "DONALDSON",
        all_cross_references: ["LF3000", "51515", "P552100", "1R0739"],
        specs: {
            "Height (mm)": "142",
            "Outer Diameter (mm)": "93.5",
            "Thread Size": "1-14 NPSM", // Parámetro Crítico
            "Micron Rating": "20-25", // Parámetro Crítico
            "Dirt Capacity (g)": "28",
            "Bypass Valve (PSI)": "11-14"
        }
    },
    
    // Diseño 2: Filtro de Combustible (Ejemplo de WIX 33166 / P556245)
    "D-F003-FUEL": {
        filter_family: "COMBUSTIBLE",
        duty_level: "HD",
        priority_reference: "P556245", // LA CLAVE: El NODO 4 usará '6245' para el SKU
        priority_brand: "DONALDSON",
        all_cross_references: ["33166", "FF5507", "P556245"],
        specs: {
            "Height (mm)": "177",
            "Outer Diameter (mm)": "93",
            "Thread Size": "M16 x 1.5", // Parámetro Crítico
            "Micron Rating": "10",
            "Hydrostatic Burst Minimum (psi)": "200",
            "Rated Flow (CFM or m3/min)": null
        }
    }
};


/**
 * NODO 3: Función de Búsqueda Estricta.
 */
export async function findExactHomologation(normalizedCode) {
    // 1. Buscar el Master ID usando el código de entrada
    const masterDesignId = REFERENCE_INDEX[normalizedCode];

    if (!masterDesignId) {
        // Fallo: No se encontró un Master ID para este código (INVALID_CODE)
        console.log(`[NODO 3] Fallo: No hay Master ID para ${normalizedCode}.`);
        return { found: false };
    }

    // 2. Recuperar la data maestra de especificaciones
    const rawData = MASTER_DESIGN_DATA[masterDesignId];

    if (!rawData) {
        // Fallo de integridad: Master ID encontrado pero data faltante
        console.error(`[NODO 3] Fallo de integridad: Data para ${masterDesignId} no existe.`);
        return { found: false };
    }

    // 3. Éxito: Devolver la data requerida
    return { 
        found: true, 
        rawData: {
            filter_family: rawData.filter_family,
            duty_level: rawData.duty_level,
            priority_reference: rawData.priority_reference, // Usado por NODO 4
            priority_brand: rawData.priority_brand,         // Usado por NODO 4
            cross_reference: rawData.all_cross_references, 
            specs: rawData.specs
        }
    };
}
