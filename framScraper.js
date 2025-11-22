const axios = require('axios');
const cheerio = require('cheerio');

// Modelo de datos para el filtro
const filterDataModel = () => ({
    found: false,
    fram_code: null,
    product_type: '',
    cross_references: [],
    equipment_applications: [], // Incluye vehículos y motores
    attributes: {},
    description: ''
});

/**
 * Busca código FRAM desde un OEM o código de la competencia.
 * NOTA: Esta función es propensa a fallos si la página de búsqueda cambia el HTML.
 * @param {string} oemCode Código OEM o de la competencia
 * @returns {Promise<string|null>} Código FRAM (PHxxxx, CAxxxx, etc.) o null
 */
async function searchFRAMEquivalent(oemCode) {
    console.log(`🔍 [FRAM] Buscando equivalente para: ${oemCode}`);
    
    try {
        const searchUrl = `https://www.framcatalog.com/search?q=${encodeURIComponent(oemCode)}`;
        
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 15000
        });
        
        const $ = cheerio.load(response.data);
        let framCode = null;
        
        // SELECTORES AJUSTADOS PARA RESULTADOS DE BÚSQUEDA
        const searchSelectors = [
            '.product-listing-item .part-number', // Resultado en una lista
            'h1.product-code',                     // Título de la página de producto (si hay redirección directa)
            '.cross-reference-match',              // Coincidencia de cruce
            'span.part-number-label + span'        // Intento de encontrar el número de pieza
        ];
        
        for (const selector of searchSelectors) {
            $(selector).each((i, elem) => {
                if (framCode) return;
                const text = $(elem).text().trim().toUpperCase();
                // Patrones de código FRAM
                const match = text.match(/(PH|CA|CS|CF|FS|CH|BG|G)\d{3,}[A-Z]*/);
                if (match) {
                    framCode = match[0];
                }
            });
            if (framCode) break;
        }
        
        if (framCode) {
            console.log(`✅ [FRAM] Encontrado: ${oemCode} → ${framCode}`);
            return framCode;
        }
        
        console.log(`⚠️ [FRAM] No se encontró equivalente para: ${oemCode}`);
        return null;
        
    } catch (error) {
        console.error(`❌ [FRAM] Error buscando: ${error.message}`);
        return null;
    }
}

/**
 * Scrape página de producto FRAM
 * @param {string} framCode Código FRAM (ej. PH3614)
 * @returns {Promise<object>} Datos del filtro extraídos
 */
async function scrapeFRAMProductPage(framCode) {
    console.log(`📄 [FRAM] Scraping: ${framCode}`);
    const data = filterDataModel();
    data.fram_code = framCode;

    try {
        // Usamos la URL canónica de FRAM para el producto
        const productUrl = `https://www.fram.com/fram-extra-guard-oil-filter-spin-on-${framCode.toLowerCase()}`;
        
        const response = await axios.get(productUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 20000 
        });
        
        const $ = cheerio.load(response.data);
        data.found = true;

        // --- 1. EXTRAER ATRIBUTOS (Ficha técnica) ---
        // AJUSTADO: Se asume que las especificaciones están en una tabla o lista de detalles.
        $('.specs-section table tr, .technical-details-list li').each((i, row) => {
            const label = $(row).find('.label, .spec-name, th').first().text().trim().replace(/[:\n]/g, '').toLowerCase();
            const value = $(row).find('.value, .spec-value, td').last().text().trim();

            if (label && value && label.length > 2) {
                // Normalización y guardado
                if (label.includes('diámetro exterior') || label.includes('od')) {
                    data.attributes.outer_diameter = value;
                } else if (label.includes('hilo') || label.includes('thread')) {
                    data.attributes.thread_size = value;
                } else if (label.includes('altura') || label.includes('length')) {
                    data.attributes.length = value;
                } else if (label.includes('micrón')) {
                    data.attributes.micron_rating = value;
                }
                
                data.attributes[label.replace(/\s/g, '_')] = value;
            }
        });
        
        // --- 2. EXTRAER REFERENCIAS CRUZADAS ---
        // AJUSTADO: Buscamos la tabla o lista de Intercambio/Equivalentes.
        $('.interchange-table tbody tr, .cross-reference-data-container table tbody tr').each((i, row) => {
            const manufacturer = $(row).find('td').eq(0).text().trim();
            const partNumber = $(row).find('td').eq(1).text().trim();

            if (manufacturer && partNumber && partNumber.length > 3) {
                data.cross_references.push({
                    manufacturer: manufacturer,
                    part_number: partNumber
                });
            }
        });

        // --- 3. EXTRAER APLICACIONES (Vehículo/Motor) ---
        // AJUSTADO: Buscamos la tabla de compatibilidad de vehículos.
        $('.vehicle-compatibility-table tbody tr, .application-data-table tbody tr').each((i, row) => {
            // Asumiendo columnas estándar: Año, Marca, Modelo, Motor
            const year = $(row).find('td').eq(0).text().trim();
            const make = $(row).find('td').eq(1).text().trim(); 
            const model = $(row).find('td').eq(2).text().trim(); 
            const engine = $(row).find('td').eq(3).text().trim(); 

            if (make && model) {
                data.equipment_applications.push({
                    year: year,
                    make: make,
                    model: model,
                    engine: engine 
                });
            }
        });

        // --- 4. EXTRAER DESCRIPCIÓN ---
        const descSelectors = [
            '.product-description-full',
            '[itemprop="description"]'
        ];
        
        for (const selector of descSelectors) {
            const desc = $(selector).attr('content') || $(selector).text().trim();
            if (desc && desc.length > 20) {
                data.description = desc.substring(0, 500).replace(/\s\s+/g, ' ');
                break;
            }
        }
        
        console.log(`✅ [FRAM] Datos extraídos: ${data.cross_references.length} refs, ${data.equipment_applications.length} aplicaciones.`);
        
        return data;
        
    } catch (error) {
        if (error.response && error.response.status === 404) {
             console.log(`⚠️ [FRAM] Producto no encontrado (404) para ${framCode}`);
        } else {
            // Capturamos el error de scraping real
            console.error(`❌ [FRAM] Error scraping ${framCode}: ${error.message}`);
        }
        return filterDataModel();
    }
}

/**
 * Función completa: busca + scrape
 */
async function getFRAMData(oemCode) {
    console.log(`🚀 [FRAM] Proceso completo: ${oemCode}`);
    
    try {
        const framCode = await searchFRAMEquivalent(oemCode);
        
        if (!framCode) {
            return filterDataModel();
        }
        
        const productData = await scrapeFRAMProductPage(framCode);
        
        return {
            found: true,
            fram_code: framCode,
            ...productData
        };
        
    } catch (error) {
        console.error(`❌ [FRAM] Error proceso completo: ${error.message}`);
        return filterDataModel();
    }
}

module.exports = {
    searchFRAMEquivalent,
    scrapeFRAMProductPage,
    getFRAMData
};
