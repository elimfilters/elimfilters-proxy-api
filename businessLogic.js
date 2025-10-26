// businessLogic.js
// Lógica de negocio para determinación de niveles de servicio
// ACTUALIZADO con reglas correctas de SKU ELIMFILTERS

function determineDutyLevel(family, specs, oemCodes, crossReference, rawData) {
    // Validar que rawData existe
    if (!rawData) {
        throw new Error('rawData no fue proporcionado. La clasificación de Duty Level requiere data maestra.');
    }
    
    // Si la data maestra ya trae duty_level, ÚSALO
    if (rawData.duty_level && rawData.duty_level.trim() !== '') {
        return rawData.duty_level;
    }
    
    // Si el duty_level está vacío o no existe, fallar explícitamente
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
// REGLAS CORRECTAS DE SKU ELIMFILTERS
// ============================================================================

/**
 * Obtener prefijo según TIPO y DUTY
 * REGLAS ACTUALIZADAS
 */
function getElimfiltersPrefix(family, duty) {
    // Normalizar entrada
    const familyUpper = String(family).toUpperCase().trim();
    const dutyUpper = String(duty).toUpperCase().trim();
    
    // Mapeo de prefijos según TIPO y DUTY
    const prefixMap = {
        // Tipos que funcionan con HD o LD
        'AIRE': 'EA1',
        'AIR': 'EA1',
        'FUEL': 'EF9',
        'COMBUSTIBLE': 'EF9',
        'OIL': 'EL8',
        'ACEITE': 'EL8',
        'CABIN': 'EC1',
        
        // Tipos específicos HD
        'FUEL SEPARATOR': 'ES9',
        'AIR DRYER': 'ED4',
        'HIDRAULIC': 'EH6',
        'HYDRAULIC': 'EH6',
        'COOLANT': 'EW7',
        'CARCAZA AIR FILTER': 'EA3',
        'TURBINE SERIES': 'ET9',
        
        // Kits según duty
        'KITS SERIES HD': 'EK5',
        'KITS SERIES LD': 'EK3'
    };
    
    // Buscar prefijo exacto
    if (prefixMap[familyUpper]) {
        return prefixMap[familyUpper];
    }
    
    // Si no se encuentra, usar prefijo genérico
    console.warn(`[SKU] Familia no encontrada: ${familyUpper}. Usando prefijo genérico.`);
    return 'ELM';
}

/**
 * Aplicar lógica de base code según reglas ELIMFILTERS
 * 
 * REGLAS:
 * - HD: Buscar primero en Donaldson, si no existe usar OEM más comercial
 * - LD: Buscar primero en FRAM, si no existe usar OEM más comercial
 */
function applyBaseCodeLogic(duty, family, oemCodes, crossReference, priorityReference) {
    const dutyUpper = String(duty).toUpperCase().trim();
    
    // Función auxiliar para extraer números de un código
    function extractNumbers(code) {
        if (!code) return null;
        const numbers = String(code).replace(/[^0-9]/g, '');
        return numbers.length > 0 ? numbers : null;
    }
    
    // Función auxiliar para buscar código por marca
    function findCodeByBrand(codes, brand) {
        if (!codes || !Array.isArray(codes) || codes.length === 0) return null;
        
        const brandUpper = brand.toUpperCase();
        
        // Buscar código que contenga la marca
        const found = codes.find(code => {
            const codeUpper = String(code).toUpperCase();
            return codeUpper.includes(brandUpper) || 
                   codeUpper.startsWith(brandUpper.substring(0, 2)); // P para Donaldson, CA para FRAM
        });
        
        return found || null;
    }
    
    // Si hay priority reference, usarlo directamente
    if (priorityReference) {
        console.log(`[SKU] Usando priority reference: ${priorityReference}`);
        return priorityReference;
    }
    
    let selectedCode = null;
    
    if (dutyUpper === 'HD') {
        // HD: Buscar Donaldson primero
        console.log('[SKU] HD detected - Buscando Donaldson...');
        
        // Buscar en cross references
        selectedCode = findCodeByBrand(crossReference, 'DONALDSON') || 
                      findCodeByBrand(crossReference, 'P5') || // Prefijo típico de Donaldson
                      findCodeByBrand(crossReference, 'P');
        
        if (!selectedCode) {
            // Si no hay Donaldson, usar el OEM más comercial (primer código)
            console.log('[SKU] Donaldson no encontrado, usando OEM más comercial');
            selectedCode = (crossReference && crossReference.length > 0) ? crossReference[0] : 
                          (oemCodes && oemCodes.length > 0) ? oemCodes[0] : null;
        }
        
    } else if (dutyUpper === 'LD') {
        // LD: Buscar FRAM primero
        console.log('[SKU] LD detected - Buscando FRAM...');
        
        // Buscar en cross references
        selectedCode = findCodeByBrand(crossReference, 'FRAM') || 
                      findCodeByBrand(crossReference, 'CA') || // Prefijo típico de FRAM
                      findCodeByBrand(crossReference, 'PH'); // Otro prefijo de FRAM
        
        if (!selectedCode) {
            // Si no hay FRAM, usar el OEM más comercial (primer código)
            console.log('[SKU] FRAM no encontrado, usando OEM más comercial');
            selectedCode = (crossReference && crossReference.length > 0) ? crossReference[0] : 
                          (oemCodes && oemCodes.length > 0) ? oemCodes[0] : null;
        }
    } else {
        // Duty no reconocido, usar primer código disponible
        console.warn(`[SKU] Duty no reconocido: ${duty}. Usando primer código disponible.`);
        selectedCode = (crossReference && crossReference.length > 0) ? crossReference[0] : 
                      (oemCodes && oemCodes.length > 0) ? oemCodes[0] : null;
    }
    
    if (!selectedCode) {
        throw new Error('No se encontró ningún código válido en referencias OEM o cross-reference');
    }
    
    console.log(`[SKU] Código seleccionado: ${selectedCode}`);
    return selectedCode;
}

/**
 * Extraer últimos 4 dígitos de un código
 */
function extractLast4Digits(code) {
    if (!code) {
        throw new Error('Código vacío para extraer dígitos');
    }
    
    // Extraer solo números
    const numbers = String(code).replace(/[^0-9]/g, '');
    
    if (numbers.length === 0) {
        throw new Error(`No se encontraron dígitos en el código: ${code}`);
    }
    
    // Obtener últimos 4 dígitos (o menos si no hay suficientes)
    const last4 = numbers.slice(-4);
    
    // Si tiene menos de 4 dígitos, rellenar con ceros a la izquierda
    return last4.padStart(4, '0');
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
    extractLast4Digits
};
