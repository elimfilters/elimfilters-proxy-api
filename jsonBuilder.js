// jsonBuilder.js (NODO 5: Garantía de Contrato de 27 Columnas)

/**
 * NODO 5: Construye la respuesta JSON final, garantizando el esquema completo.
 * @param {object} processedData - Datos completos del NODO 4 (incluyendo specs).
 * @returns {object} Objeto JSON con la estructura del sheet.
 */
export function buildFilterResponse(processedData) {
    const MAX_REFS = 10;
    const { specs, ...metadata } = processedData;

    // Límite de referencias (Blindaje)
    const finalOemCodes = (metadata.oemCodes || []).slice(0, MAX_REFS);
    const finalCrossReference = (metadata.crossReference || []).slice(0, MAX_REFS);

    // Mapeo auxiliar para asegurar que los arrays se muestren como arrays, 
    // y si no existen en processedData, se muestren como arrays vacíos.
    const getArrayValue = (key) => metadata[key] || [];
    
    // El objeto de respuesta garantiza que todas las 27 columnas del sheet existan.
    const response = {
        // --- IDENTIFICADORES Y CLASIFICACIÓN (5 Columnas) ---
        "query_norm": metadata.queryNorm || null,
        "SKU": metadata.sku || null,
        "OEM Codes": finalOemCodes, 
        "Cross Reference": finalCrossReference,
        "Filter Type": metadata.filterType || null,
        "Media Type": metadata.mediaType || null, // Clave 6
        "Subtype": metadata.subtype || null,
        "Duty": metadata.duty || null,
        
        // --- APLICACIONES (2 Columnas) ---
        "Engine Applications": getArrayValue("engineApps"),
        "Equipment Applications": getArrayValue("equipmentApps"), // Clave 10
        
        // --- ESPECIFICACIONES FÍSICAS (5 Columnas) ---
        "Height (mm)": specs["Height (mm)"] || null,
        "Outer Diameter (mm)": specs["Outer Diameter (mm)"] || null,
        "Thread Size": specs["Thread Size"] || null,
        "Gasket OD (mm)": specs["Gasket OD (mm)"] || null,
        "Gasket ID (mm)": specs["Gasket ID (mm)"] || null, // Clave 15
        
        // --- RENDIMIENTO Y PRESIÓN (6 Columnas) ---
        "Bypass Valve (PSI)": specs["Bypass Valve (PSI)"] || null,
        "Micron Rating": specs["Micron Rating"] || null,
        "ISO Main Efficiency": specs["ISO Main Efficiency"] || null,
        "ISO Test Method": specs["ISO Test Method"] || null,
        "Beta 200": specs["Beta 200"] || null, // Clave 20
        "Hydrostatic Burst Minimum (psi)": specs["Hydrostatic Burst Minimum (psi)"] || null,
        "Dirt Capacity (g)": specs["Dirt Capacity (g)"] || null,
        
        // --- FLUJO Y DIMENSIONES DE PANEL (3 Columnas) ---
        "Rated Flow (CFM or m3/min)": specs["Rated Flow (CFM or m3/min)"] || null,
        "Panel Width (mm)": specs["Panel Width (mm)"] || null,
        "Panel Depth (mm)": specs["Panel Depth (mm)"] || null, // Clave 25
        
        // --- METADATOS (2 Columnas) ---
        "created_at": metadata.createdAt || new Date().toISOString(), // Clave 26
        "ok": true, // Clave 27
    };

    return { results: [response] };
}

// Exportar solo la función para sintaxis ES Module
// Nota: Debe asegurarse de que las funciones auxiliares se exportan de sus archivos correspondientes.
// Nota: La cuenta total es 27 columnas (5+6+2+5+6+3+2 = 29, revisando su lista, omitimos _raw y añadimos dos para un total de 27 visibles en el Sheet).
