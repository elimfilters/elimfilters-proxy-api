// jsonBuilder.js (Constructor de Respuestas JSON)
/**
 * NODO 5: Construcción de respuesta JSON
 * Mapea datos procesados a la estructura de 27 columnas requerida
 */

/**
 * Validar que processedData tenga los campos mínimos
 */
function validateProcessedData(data) {
    const requiredFields = ['sku', 'filterType', 'duty', 'queryNorm'];
    
    const missingFields = requiredFields.filter(field => 
        !data[field] || (typeof data[field] === 'string' && data[field].trim() === '')
    );
    
    if (missingFields.length > 0) {
        throw new Error(`Campos requeridos faltantes en processedData: ${missingFields.join(', ')}`);
    }
    
    return true;
}

/**
 * Extraer especificaciones en formato clave-valor
 */
function buildSpecsObject(specs) {
    if (!specs) return {};
    
    if (typeof specs === 'object' && !Array.isArray(specs)) {
        return specs;
    }
    
    return {};
}

/**
 * Construir lista de códigos OEM
 */
function buildOemList(oemCodes) {
    if (!oemCodes) return [];
    
    if (Array.isArray(oemCodes)) {
        return oemCodes.map(code => String(code).toUpperCase().trim()).filter(c => c);
    }
    
    return [];
}

/**
 * Construir lista de referencias cruzadas
 */
function buildCrossRefList(crossReference) {
    if (!crossReference) return [];
    
    if (Array.isArray(crossReference)) {
        return crossReference.map(ref => String(ref).toUpperCase().trim()).filter(r => r);
    }
    
    if (typeof crossReference === 'object') {
        return Object.values(crossReference)
            .map(ref => String(ref).toUpperCase().trim())
            .filter(r => r);
    }
    
    return [];
}

/**
 * FUNCIÓN PRINCIPAL: Construir respuesta JSON completa
 * Estructura de 27 campos para compatibilidad con sistema
 */
function buildFilterResponse(processedData) {
    console.log(`[NODO 5] Iniciando construcción de respuesta para SKU: ${processedData.sku}`);
    
    try {
        // Validar datos de entrada
        validateProcessedData(processedData);
        
        // Extraer y normalizar datos
        const specs = buildSpecsObject(processedData.specs);
        const oemCodes = buildOemList(processedData.oemCodes);
        const crossReferences = buildCrossRefList(processedData.crossReference);
        
        // Construir objeto de respuesta con 27 campos
        const filterResponse = {
            // 1. Identificador de consulta
            query_normalized: processedData.queryNorm,
            
            // 2. SKU Generado (LA SALIDA PRINCIPAL)
            sku: processedData.sku,
            
            // 3-4. Componentes del SKU
            sku_prefix: processedData.prefix || '',
            sku_base_code: processedData.baseCode || '',
            
            // 5-6. Clasificación
            filter_family: processedData.filterType || processedData.family || '',
            duty_level: processedData.duty || '',
            
            // 7-8. Referencias de prioridad
            priority_reference: processedData.priority_reference || '',
            priority_brand: processedData.priority_brand || '',
            
            // 9-10. Especificaciones críticas
            height_mm: specs['Height (mm)'] || null,
            outer_diameter_mm: specs['Outer Diameter (mm)'] || null,
            
            // 11-13. Parámetros de filtración
            thread_size: specs['Thread Size'] || null,
            micron_rating: specs['Micron Rating'] || null,
            bypass_valve_psi: specs['Bypass Valve (PSI)'] || null,
            
            // 14-15. Capacidad y resistencia
            dirt_capacity_g: specs['Dirt Capacity (g)'] || null,
            hydrostatic_burst_psi: specs['Hydrostatic Burst Minimum (psi)'] || null,
            
            // 16. Material
            material: specs['Material'] || null,
            
            // 17. Tipo de enrosque
            spin_on: specs['Spin-on'] || false,
            
            // 18-19. Códigos de referencia (listas)
            oem_codes: oemCodes,
            cross_references: crossReferences,
            
            // 20-22. Metadata de procesamiento
            source: processedData.source || 'MASTER_DATA',
            processed_timestamp: processedData.timestamp || new Date().toISOString(),
            was_cached: processedData.cached || false,
            
            // 23-25. Información de respuesta
            ok: true,
            status: 'SUCCESS',
            message: `Filtro identificado exitosamente: ${processedData.sku}`,
            
            // 26. Design ID (rastreabilidad)
            design_id: processedData.design_id || '',
            
            // 27. Versión de respuesta
            response_version: '2.0'
        };
        
        console.log(`[NODO 5] ✓ Respuesta construida exitosamente`);
        
        // Envolver en estructura estándar
        return {
            results: [filterResponse],
            metadata: {
                total_results: 1,
                query: processedData.queryNorm,
                sku_generated: processedData.sku,
                success: true
            }
        };
        
    } catch (error) {
        console.error(`[NODO 5] ✗ Error al construir respuesta:`, error.message);
        
        // Retornar estructura de error
        return {
            results: [{
                error: "RESPONSE_BUILD_FAILED",
                message: `No se pudo construir la respuesta: ${error.message}`,
                ok: false,
                status: 'ERROR'
            }],
            metadata: {
                success: false
            }
        };
    }
}

/**
 * FUNCIÓN AUXILIAR: Construir respuesta de error
 */
function buildErrorResponse(code, errorMessage, details = {}) {
    console.error(`[ERROR] ${errorMessage}`);
    
    return {
        results: [{
            query_normalized: code || 'UNKNOWN',
            error: errorMessage,
            details: details,
            ok: false,
            status: 'ERROR',
            response_version: '2.0'
        }],
        metadata: {
            success: false,
            error_type: errorMessage
        }
    };
}

/**
 * FUNCIÓN AUXILIAR: Construir respuesta vacía (no encontrado)
 */
function buildNotFoundResponse(code) {
    return buildErrorResponse(
        code,
        'NOT_FOUND',
        {
            message: 'El código ingresado no existe en la base de datos maestra',
            query: code
        }
    );
}

/**
 * FUNCIÓN AUXILIAR: Construir respuesta de validación fallida
 */
function buildValidationErrorResponse(code, validationErrors) {
    return buildErrorResponse(
        code,
        'VALIDATION_ERROR',
        {
            message: 'La entrada no pasó validación',
            errors: validationErrors
        }
    );
}

/**
 * FUNCIÓN AUXILIAR: Validar estructura de respuesta
 */
function validateResponseStructure(response) {
    const requiredTopLevel = ['results', 'metadata'];
    const missingTopLevel = requiredTopLevel.filter(field => !(field in response));
    
    if (missingTopLevel.length > 0) {
        throw new Error(`Respuesta incompleta. Campos faltantes: ${missingTopLevel.join(', ')}`);
    }
    
    if (!Array.isArray(response.results) || response.results.length === 0) {
        throw new Error('results debe ser un array no vacío');
    }
    
    const result = response.results[0];
    
    // Si es un resultado de éxito
    if (result.ok === true) {
        const requiredSuccessFields = ['sku', 'filter_family', 'duty_level', 'ok', 'status'];
        const missingSuccess = requiredSuccessFields.filter(field => !(field in result));
        
        if (missingSuccess.length > 0) {
            throw new Error(`Resultado de éxito incompleto. Campos faltantes: ${missingSuccess.join(', ')}`);
        }
    }
    // Si es un resultado de error
    else if (result.ok === false) {
        const requiredErrorFields = ['error', 'ok', 'status'];
        const missingError = requiredErrorFields.filter(field => !(field in result));
        
        if (missingError.length > 0) {
            throw new Error(`Resultado de error incompleto. Campos faltantes: ${missingError.join(', ')}`);
        }
    }
    
    return true;
}

/**
 * FUNCIÓN DE TESTING
 */
function testResponseBuilder() {
    console.log("\n[TEST] Probando buildFilterResponse...\n");
    
    const mockData = {
        queryNorm: "P556245",
        sku: "ELM-6245",
        prefix: "ELM",
        baseCode: "6245",
        filterType: "COMBUSTIBLE",
        family: "COMBUSTIBLE",
        duty: "HD",
        priority_reference: "P556245",
        priority_brand: "DONALDSON",
        specs: {
            "Height (mm)": "177",
            "Outer Diameter (mm)": "93",
            "Thread Size": "M16 x 1.5",
            "Micron Rating": "10",
            "Hydrostatic Burst Minimum (psi)": "200"
        },
        oemCodes: ["33166", "FF5507"],
        crossReference: ["P556245"],
        source: "MASTER_DATA",
        timestamp: new Date().toISOString(),
        cached: false,
        design_id: "D-F003-FUEL"
    };
    
    try {
        const response = buildFilterResponse(mockData);
        validateResponseStructure(response);
        console.log("[TEST] ✓ Response válida:");
        console.log(JSON.stringify(response, null, 2));
        return response;
    } catch (error) {
        console.error("[TEST] ✗ Error:", error.message);
        throw error;
    }
}

// ============================================================================
// EXPORTACIONES (CommonJS)
// ============================================================================

module.exports = {
    buildFilterResponse,
    buildErrorResponse,
    buildNotFoundResponse,
    buildValidationErrorResponse,
    validateResponseStructure,
    testResponseBuilder
};
