// businessLogic.js
// Lógica de negocio para determinación de niveles de servicio y generación de SKU

function determineDutyLevel(family, specs, oemCodes, crossReference, rawData) {
    // Validar que rawData existe
    if (!rawData) {
        throw new Error('rawData no fue proporcionado. La clasificación de Duty Level requiere data maestra.');
    }

    // SOLUCIÓN CORRECTA: Si la data maestra (NODO 3) ya trae duty_level, ÚSALO
    // Esta es la fuente de verdad
    if (rawData.duty_level && rawData.duty_level.trim() !== '') {
        return rawData.duty_level;
    }

    // Si el duty_level está vacío o no existe, fallar explícitamente
    // No hacer suposiciones basadas en OD o capacidad
    throw new Error(
        `Clasificación de Duty Level no definida en la base de datos maestra para SKU: ${rawData.sku || 'desconocido'}`
    );
}

function validateMasterDataIntegrity(rawData) {
    // Validar que todos los campos críticos existan en la data maestra
    const requiredFields = ['duty_level', 'sku', 'family', 'specs'];
    
    const missingFields = requiredFields.filter(field => 
        !rawData[field] || (typeof rawData[field] === 'string' && rawData[field].trim() === '')
    );

    if (missingFields.length > 0) {
        throw new Error(
            `Campos críticos faltantes en data maestra: ${missingFields.join(', ')}`
        );
    }

    return true;
}

function processFilterData(family, specs, oemCodes, crossReference, rawData) {
    // Validar integridad de data maestra primero
    validateMasterDataIntegrity(rawData);
    
    // Obtener duty level desde data maestra validada
    const dutyLevel = determineDutyLevel(family, specs, oemCodes, crossReference, rawData);
    
    return {
        sku: rawData.sku,
        family: rawData.family,
        specs: rawData.specs,
        duty_level: dutyLevel,
        crossReference: crossReference,
        oemCodes: oemCodes,
        validated: true,
        timestamp: new Date().toISOString()
    };
}

// ============================================================================
// PREFIJOS ELIMFILTERS ACTUALIZADOS
// ============================================================================

function getElimfiltersPrefix(family, dutyLevel) {
    const familyNormalized = family.toUpperCase().trim();
    const dutyNormalized = dutyLevel ? dutyLevel.toUpperCase().trim() : 'HD';
    
    // Mapeo de familias a prefijos
    const prefixMap = {
        'ACEITE': 'EL8',
        'OIL': 'EL8',
        'COMBUSTIBLE': 'EF9',
        'FUEL': 'EF9',
        'AIRE': 'EA1',
        'AIR': 'EA1',
        'AIRE_CABINA': 'EC1',
        'CABIN': 'EC1',
        'CABIN AIR': 'EC1',
        'HIDRAULICO': 'EH6',
        'HYDRAULIC': 'EH6',
        'AIR_DRYER': 'ED4',
        'AIR DRYER': 'ED4',
        'SEPARADOR': 'EF9',
        'SEPARATOR': 'EF9',
        'FUEL WATER SEPARATOR': 'EF9',
        'REFRIGERANTE': 'EW7',
        'COOLANT': 'EW7',
        'CARCASA': 'EB1',
        'HOUSING': 'EB1',
        'TURBINA': 'EFT9',
        'TURBINE': 'EFT9',
        'KIT_DIESEL': 'EK5',
        'KIT_PASAJEROS': 'EK3'
    };
    
    // Casos especiales para kits
    if (familyNormalized.includes('KIT')) {
        if (dutyNormalized === 'HD') {
            return 'EK5'; // Kits para motores diesel (HD)
        } else if (dutyNormalized === 'LD') {
            return 'EK3'; // Kits para vehículos pasajeros (LD)
        }
    }
    
    // Buscar prefijo en el mapa
    return prefixMap[familyNormalized] || 'EL8'; // Default: EL8
}

// ============================================================================
// FUNCIONES DE EXTRACCIÓN Y BÚSQUEDA DE CÓDIGOS
// ============================================================================

function extractLast4Digits(code) {
    // Extraer solo números del código
    const numbers = code.replace(/\D/g, '');
    
    // Tomar los últimos 4 dígitos
    if (numbers.length >= 4) {
        return numbers.slice(-4);
    }
    
    // Si tiene menos de 4 dígitos, rellenar con ceros a la izquierda
    return numbers.padStart(4, '0');
}

function findDonaldsonCode(crossReference) {
    if (!crossReference || !Array.isArray(crossReference)) {
        return null;
    }
    
    // Buscar código Donaldson en crossReference
    const donaldson = crossReference.find(ref => 
        ref.brand && ref.brand.toUpperCase().includes('DONALDSON')
    );
    
    return donaldson ? donaldson.code : null;
}

function findFramCode(crossReference) {
    if (!crossReference || !Array.isArray(crossReference)) {
        return null;
    }
    
    // Buscar código Fram en crossReference
    const fram = crossReference.find(ref => 
        ref.brand && ref.brand.toUpperCase().includes('FRAM')
    );
    
    return fram ? fram.code : null;
}

function getMostCommonOEM(oemCodes) {
    if (!oemCodes || !Array.isArray(oemCodes) || oemCodes.length === 0) {
        return null;
    }
    
    // Marcas más comerciales en orden de prioridad
    const commercialBrands = [
        'CATERPILLAR', 'CAT', 'CUMMINS', 'DETROIT', 'VOLVO', 
        'MACK', 'PACCAR', 'NAVISTAR', 'INTERNATIONAL', 'FREIGHTLINER',
        'KOMATSU', 'JOHN DEERE', 'CASE', 'NEW HOLLAND'
    ];
    
    // Buscar el OEM más comercial
    for (const brand of commercialBrands) {
        const oem = oemCodes.find(code => 
            code.toUpperCase().includes(brand)
        );
        if (oem) return oem;
    }
    
    // Si no encuentra ninguno de los comerciales, retornar el primero
    return oemCodes[0];
}

function applyBaseCodeLogic(dutyLevel, family, oemCodes, crossReference) {
    let baseCode = null;
    
    if (dutyLevel === 'HD') {
        // Para HD: buscar Donaldson primero
        const donaldsonCode = findDonaldsonCode(crossReference);
        
        if (donaldsonCode) {
            baseCode = donaldsonCode;
        } else {
            // Si no hay Donaldson, usar OEM más comercial
            baseCode = getMostCommonOEM(oemCodes);
        }
    } else if (dutyLevel === 'LD') {
        // Para LD: buscar Fram primero
        const framCode = findFramCode(crossReference);
        
        if (framCode) {
            baseCode = framCode;
        } else {
            // Si no hay Fram, usar OEM más comercial
            baseCode = getMostCommonOEM(oemCodes);
        }
    } else {
        // Para otros duty levels, usar OEM más comercial
        baseCode = getMostCommonOEM(oemCodes);
    }
    
    if (!baseCode) {
        throw new Error('No se encontró base code válido en referencias OEM o cross-reference');
    }
    
    // Extraer últimos 4 dígitos
    return extractLast4Digits(baseCode);
}

// ============================================================================
// GENERACIÓN DE SKU
// ============================================================================

function generateSKU(family, dutyLevel, oemCodes, crossReference) {
    // Obtener prefijo según familia y duty level
    const prefix = getElimfiltersPrefix(family, dutyLevel);
    
    // Obtener últimos 4 dígitos según lógica de duty level
    const last4Digits = applyBaseCodeLogic(dutyLevel, family, oemCodes, crossReference);
    
    // Construir SKU: PREFIJO + 4 DÍGITOS
    return `${prefix}${last4Digits}`;
}

// ============================================================================
// EXPORTACIONES (CommonJS)
// ============================================================================

module.exports = {
    determineDutyLevel,
    validateMasterDataIntegrity,
    processFilterData,
    getElimfiltersPrefix,
    applyBaseCodeLogic,
    generateSKU,
    extractLast4Digits,
    findDonaldsonCode,
    findFramCode,
    getMostCommonOEM
};
