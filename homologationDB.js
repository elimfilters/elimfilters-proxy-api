// homologationDB.js (Base de Datos de Homologación - Fuente de Verdad)
/**
 * TABLA 1: ÍNDICE DE BÚSQUEDA RÁPIDA
 */
const REFERENCE_INDEX = {
    "33166": "D-F003-FUEL",
    "FF5507": "D-F003-FUEL",
    "P556245": "D-F003-FUEL",
    "LF3000": "D-F001-OIL",
    "P552100": "D-F001-OIL",
    "51515": "D-F001-OIL",
    "1R0739": "D-F001-OIL"
};

/**
 * TABLA 2: REGISTRO MAESTRO DE ESPECIFICACIONES
 */
const MASTER_DESIGN_DATA = {
    "D-F001-OIL": {
        design_id: "D-F001-OIL",
        master_name: "Filtro de Aceite Donaldson - Serie 1",
        filter_family: "ACEITE",
        duty_level: "HD",
        priority_reference: "P552100",
        priority_brand: "DONALDSON",
        all_cross_references: ["LF3000", "51515", "P552100", "1R0739"],
        oem_codes: ["1R0739", "51515"],
        specs: {
            "Height (mm)": "142",
            "Outer Diameter (mm)": "93.5",
            "Thread Size": "1-14 NPSM",
            "Micron Rating": "20-25",
            "Dirt Capacity (g)": "28",
            "Bypass Valve (PSI)": "11-14",
            "Spin-on": true,
            "Material": "Paper/Glass Fiber"
        },
        created_at: "2024-01-01T00:00:00Z",
        last_updated: "2024-10-16T00:00:00Z",
        is_active: true,
        version: 1
    },
    "D-F003-FUEL": {
        design_id: "D-F003-FUEL",
        master_name: "Filtro de Combustible Donaldson - Serie 3",
        filter_family: "COMBUSTIBLE",
        duty_level: "HD",
        priority_reference: "P556245",
        priority_brand: "DONALDSON",
        all_cross_references: ["33166", "FF5507", "P556245"],
        oem_codes: ["33166"],
        specs: {
            "Height (mm)": "177",
            "Outer Diameter (mm)": "93",
            "Thread Size": "M16 x 1.5",
            "Micron Rating": "10",
            "Hydrostatic Burst Minimum (psi)": "200",
            "Collapse Differential (psi)": "25",
            "Flow Rating (LPM)": "150",
            "Spin-on": true,
            "Material": "Synthetic Fiber"
        },
        created_at: "2024-01-01T00:00:00Z",
        last_updated: "2024-10-16T00:00:00Z",
        is_active: true,
        version: 1
    }
};

function validateMasterRecord(record, designId) {
    const requiredFields = [
        'design_id',
        'master_name',
        'filter_family',
        'duty_level',
        'priority_reference',
        'priority_brand',
        'all_cross_references',
        'specs',
        'is_active'
    ];
    
    const missingFields = requiredFields.filter(field => 
        !record[field] || 
        (typeof record[field] === 'string' && record[field].trim() === '')
    );
    
    if (missingFields.length > 0) {
        throw new Error(
            `Validación fallida para ${designId}. Campos faltantes: ${missingFields.join(', ')}`
        );
    }
    
    const validDutyLevels = ['HD', 'STANDARD', 'LIGHT', 'HEAVY'];
    if (!validDutyLevels.includes(record.duty_level)) {
        throw new Error(
            `duty_level inválido para ${designId}: ${record.duty_level}`
        );
    }
    
    const validFamilies = ['ACEITE', 'COMBUSTIBLE', 'AIRE', 'HIDRÁULICO'];
    if (!validFamilies.includes(record.filter_family)) {
        throw new Error(
            `filter_family inválida para ${designId}: ${record.filter_family}`
        );
    }
    
    if (!record.all_cross_references.includes(record.priority_reference)) {
        throw new Error(
            `priority_reference ${record.priority_reference} no existe en all_cross_references para ${designId}`
        );
    }
    
    return true;
}

async function findExactHomologation(normalizedCode) {
    console.log(`[NODO 3] Buscando homologación para: ${normalizedCode}`);
    
    if (!normalizedCode || typeof normalizedCode !== 'string') {
        console.error(`[NODO 3] Error: Código inválido`);
        return { found: false, error: "INVALID_INPUT" };
    }
    
    const masterDesignId = REFERENCE_INDEX[normalizedCode];
    if (!masterDesignId) {
        console.log(`[NODO 3] ✗ No hay Master ID para ${normalizedCode}`);
        return {
            found: false,
            error: "NOT_IN_INDEX",
            normalized_code: normalizedCode
        };
    }
    
    console.log(`[NODO 3] ✓ Master ID encontrado: ${masterDesignId}`);
    
    const rawData = MASTER_DESIGN_DATA[masterDesignId];
    if (!rawData) {
        console.error(`[NODO 3] ✗ Integridad fallida: Data para ${masterDesignId} no existe`);
        return {
            found: false,
            error: "INTEGRITY_ERROR",
            master_design_id: masterDesignId
        };
    }
    
    try {
        validateMasterRecord(rawData, masterDesignId);
    } catch (validationError) {
        console.error(`[NODO 3] ✗ Validación fallida:`, validationError.message);
        return {
            found: false,
            error: "VALIDATION_ERROR",
            details: validationError.message,
            master_design_id: masterDesignId
        };
    }
    
    if (!rawData.is_active) {
        console.warn(`[NODO 3] ⚠ Registro inactivo para ${masterDesignId}`);
        return {
            found: false,
            error: "INACTIVE_RECORD",
            master_design_id: masterDesignId
        };
    }
    
    console.log(`[NODO 3] ✓ Homologación válida encontrada: ${rawData.master_name}`);
    
    return {
        found: true,
        masterDesignId: masterDesignId,
        rawData: {
            design_id: rawData.design_id,
            master_name: rawData.master_name,
            filter_family: rawData.filter_family,
            duty_level: rawData.duty_level,
            priority_reference: rawData.priority_reference,
            priority_brand: rawData.priority_brand,
            cross_reference: rawData.all_cross_references,
            oem_codes: rawData.oem_codes,
            specs: rawData.specs,
            created_at: rawData.created_at,
            last_updated: rawData.last_updated,
            version: rawData.version
        }
    };
}

function getCodesForDesign(designId) {
    return Object.entries(REFERENCE_INDEX)
        .filter(([_, id]) => id === designId)
        .map(([code, _]) => code);
}

function listActiveDesigns() {
    return Object.entries(MASTER_DESIGN_DATA)
        .filter(([_, data]) => data.is_active)
        .map(([id, data]) => ({
            design_id: id,
            name: data.master_name,
            family: data.filter_family,
            duty_level: data.duty_level
        }));
}

function validateDatabaseIntegrity() {
    console.log("[DB] Validando integridad de base de datos...");
    const errors = [];
    
    const indexedIds = new Set(Object.values(REFERENCE_INDEX));
    for (const designId of indexedIds) {
        if (!MASTER_DESIGN_DATA[designId]) {
            errors.push(`Master ID ${designId} en índice pero no en datos maestros`);
        }
    }
    
    for (const [designId, record] of Object.entries(MASTER_DESIGN_DATA)) {
        try {
            validateMasterRecord(record, designId);
        } catch (error) {
            errors.push(error.message);
        }
    }
    
    if (errors.length > 0) {
        console.error("[DB] ✗ Errores de integridad encontrados:");
        errors.forEach(err => console.error(`  - ${err}`));
        return false;
    }
    
    console.log("[DB] ✓ Base de datos íntegra y consistente");
    return true;
}

validateDatabaseIntegrity();

module.exports = {
    findExactHomologation,
    getCodesForDesign,
    listActiveDesigns,
    validateDatabaseIntegrity
};
