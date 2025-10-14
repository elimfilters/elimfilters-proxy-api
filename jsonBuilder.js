// jsonBuilder.js (NODO 5: Garantía de Contrato)

/**
 * NODO 5: Construye la respuesta JSON final, garantizando el esquema completo.
 * @param {object} processedData - Datos completos del NODO 4 (incluyendo specs y clasif).
 * @returns {object} Objeto JSON con la estructura del sheet.
 */
function buildFilterResponse(processedData) {
    const MAX_REFS = 10;
    const { specs, ...metadata } = processedData;

    // Límite de referencias (Blindaje)
    const finalOemCodes = (metadata.oemCodes || []).slice(0, MAX_REFS);
    const finalCrossReference = (metadata.crossReference || []).slice(0, MAX_REFS);
    
    // El objeto de respuesta garantiza que todas las columnas del sheet existan.
    const response = {
        // --- IDENTIFICADORES Y CLASIFICACIÓN ---
        "query_norm": metadata.queryNorm || null,
        "SKU": metadata.sku || null,
        "OEM Codes": finalOemCodes, 
        "Cross Reference": finalCrossReference,
        "Filter Type": metadata.filterType || null,
        "Media Type": metadata.mediaType || null,
        "Subtype": metadata.subtype || null,
        "Duty": metadata.duty || null,
        
        // --- APLICACIONES ---
        "Engine Applications": metadata.engineApps || [],
        "Equipment Applications": metadata.equipmentApps || [],
        
        // --- ESPECIFICACIONES FÍSICAS Y DE RENDIMIENTO (Columna del Sheet) ---
        "Height (mm)": specs["Height (mm)"] || null,
        "Outer Diameter (mm)": specs["Outer Diameter (mm)"] || null,
        "Thread Size": specs["Thread Size"] || null,
        "Gasket OD (mm)": specs["Gasket OD (mm)"] || null,
        "Gasket ID (mm)": specs["Gasket ID (mm)"] || null,
        "Bypass Valve (PSI)": specs["Bypass Valve (PSI)"] || null,
        "Micron Rating": specs["Micron Rating"] || null,
        "ISO Main Efficiency": specs["ISO Main Efficiency"] || null,
        "ISO Test Method": specs["ISO Test Method"] || null,
        "Beta 200": specs["Beta 200"] || null,
        "Hydrostatic Burst Minimum (psi)": specs["Hydrostatic Burst Minimum (psi)"] || null,
        "Dirt Capacity (g)": specs["Dirt Capacity (g)"] || null,
        "Rated Flow (CFM or m3/min)": specs["Rated Flow (CFM or m3/min)"] || null,
        "Panel Width (mm)": specs["Panel Width (mm)"] || null,
        "Panel Depth (mm)": specs["Panel Depth (mm)"] || null,

        // --- METADATOS ---
        "created_at": metadata.createdAt || new Date().toISOString(),
        "ok": metadata.ok || true, 
    };

    return { results: [response] };
}

module.exports = {
    buildFilterResponse
};
