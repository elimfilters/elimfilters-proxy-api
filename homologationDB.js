// homologationDB.js (NODO 3: Búsqueda Estricta)

// --- SIMULACIÓN DE LA BASE DE DATOS DE HOMOLOGACIONES ---
// En un entorno real, esta sería tu API o DB principal, bien indexada.
// La clave de búsqueda puede ser el 'master_id' o cualquier 'query_norm'.
const MASTER_HOMOLOGATION_DATA = {
    // Ejemplo de un filtro HD
    "P552100": {
        master_id: "F001",
        oem_codes: ["1R0739", "3969341", "RE504836"],
        cross_reference: ["LF3000", "51515", "PH3539", "P552100"], // Incluye la propia referencia
        filter_family: "ACEITE",
        duty_level: "HD", // Asignación inicial para NODO 4
        specs: {
            "Height (mm)": "142",
            "Outer Diameter (mm)": "93.5",
            "Thread Size": "1-14 NPSM",
            "Dirt Capacity (g)": "28",
            "Micron Rating": "20-25"
        }
    },
    // Ejemplo de un filtro LD
    "PH3614": {
        master_id: "F002",
        oem_codes: ["90915-YZZF2", "26300-35503"],
        cross_reference: ["51356", "PH3614", "W920/21"],
        filter_family: "ACEITE",
        duty_level: "LD", // Asignación inicial para NODO 4
        specs: {
            "Height (mm)": "85",
            "Outer Diameter (mm)": "80",
            "Thread Size": "3/4-16",
            "Dirt Capacity (g)": "12",
            "Micron Rating": "25-30"
        }
    }
    // ... Cientos de registros aquí
};


/**
 * NODO 3: Busca una coincidencia EXACTA en la base de datos maestra.
 * @param {string} normalizedCode 
 * @returns {object} {found: boolean, rawData: object}
 */
async function findExactHomologation(normalizedCode) {
    // 1. Búsqueda por clave principal (rápida)
    let rawData = MASTER_HOMOLOGATION_DATA[normalizedCode];

    // 2. Búsqueda secundaria (si no se encuentra como clave principal)
    if (!rawData) {
        for (const key in MASTER_HOMOLOGATION_DATA) {
            const item = MASTER_HOMOLOGATION_DATA[key];
            const allRefs = [...item.oem_codes, ...item.cross_reference];
            if (allRefs.includes(normalizedCode)) {
                rawData = item;
                break;
            }
        }
    }

    if (!rawData) {
        return { found: false };
    }

    console.log(`[NODO 3] Coincidencia exacta encontrada para ${normalizedCode}.`);
    return { found: true, rawData };
}

module.exports = {
    findExactHomologation
};
