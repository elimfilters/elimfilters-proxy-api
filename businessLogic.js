// businessLogic.js
// Lógica de negocio para determinación de niveles de servicio
// CORRECCIÓN: Eliminada lógica de suposición, implementada validación de data maestra

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

// Funciones auxiliares para generación de SKU
function getElimfiltersPrefix(family) {
    const prefixMap = {
        'ACEITE': 'ELM-OIL-',
        'COMBUSTIBLE': 'ELM-FUEL-',
        'AIRE': 'ELM-AIR-',
        'HIDRÁULICO': 'ELM-HYD-'
    };
    
    return prefixMap[family] || 'ELM-';
}

function applyBaseCodeLogic(duty, family, oemCodes, crossReference) {
    // Lógica para extraer base code de referencias
    if (crossReference && Array.isArray(crossReference) && crossReference.length > 0) {
        return crossReference[0];
    }
    
    if (oemCodes && Array.isArray(oemCodes) && oemCodes.length > 0) {
        return oemCodes[0];
    }
    
    throw new Error('No se encontró base code válido en referencias OEM o cross-reference');
}

// ============================================================================
// EXPORTACIONES (CommonJS)
// ============================================================================

module.exports = {
    determineDutyLevel,
    validateMasterDataIntegrity,
    processFilterData,
    getElimfiltersPrefix,
    applyBaseCodeLogic
};
