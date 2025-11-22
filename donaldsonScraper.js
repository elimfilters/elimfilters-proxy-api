const axios = require('axios');
const cheerio = require('cheerio');

// Modelo de datos para el filtro
const filterDataModel = () => ({
    found: false,
    donaldson_code: null,
    product_type: '',
    cross_references: [],
    equipment_applications: [], // Incluye Engine y Equipment
    attributes: {},
    description: ''
});

/**
 * Función central para obtener datos del filtro de Donaldson
 * @param {string} donaldsonCode Código Pxxxxxx de Donaldson
 * @returns {Promise<object>} Datos del filtro extraídos
 */
async function scrapeDonaldsonProductPage(donaldsonCode) {
    console.log(`📄 [Donaldson] Scraping: ${donaldsonCode}`);
    const data = filterDataModel();
    data.donaldson_code = donaldsonCode;

    try {
        // La URL de un producto real de Donaldson con código Pxxxxxx
        const productUrl = `https://shop.donaldson.com/store/en-us/product/${donaldsonCode}/80`;
        const response = await axios.get(productUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 20000 // Aumentado el timeout
        });

        const $ = cheerio.load(response.data);
        data.found = true;

        // 1. EXTRAER ATRIBUTOS (Ficha técnica/OEM Codes)
        // La información de atributos suele estar en tablas de especificaciones
        $('.product-details-table tr').each((i, row) => {
            const label = $(row).find('td:nth-child(1)').text().trim().replace(/[:\n]/g, '').toLowerCase();
            const value = $(row).find('td:nth-child(2)').text().trim();

            if (label && value) {
                // Capturar OEM codes (si están listados como 'Primary Application')
                if (label.includes('primary application') || label.includes('oem')) {
                    data.attributes.primary_oem_code = value;
                }
                // Capturar el resto de atributos
                data.attributes[label.replace(/\s/g, '_')] = value;
            }
        });

        // 2. EXTRAER REFERENCIAS CRUZADAS (Pestaña "Cross Reference")
        // Buscar la sección de cruces. A menudo son listas de Fabricante/Parte.
        $('#cross-reference-list tbody tr').each((i, row) => {
            const manufacturer = $(row).find('td:nth-child(1)').text().trim();
            const partNumber = $(row).find('td:nth-child(2)').text().trim();

            if (manufacturer && partNumber) {
                data.cross_references.push({
                    manufacturer: manufacturer,
                    part_number: partNumber
                });
            }
        });
        
        // Intento secundario si el selector #cross-reference-list no funciona (puede variar)
        if (data.cross_references.length === 0) {
             $('.cross-reference-section table tbody tr').each((i, row) => {
                const manufacturer = $(row).find('td:nth-child(1)').text().trim();
                const partNumber = $(row).find('td:nth-child(2)').text().trim();
                if (manufacturer && partNumber) {
                    data.cross_references.push({ manufacturer, part_number: partNumber });
                }
            });
        }


        // 3. EXTRAER APLICACIONES (Pestaña "Equipment Applications")
        // Buscar la tabla de aplicaciones. Este selector es crítico y debe ser exacto.
        $('#equipment-application-table tbody tr').each((i, row) => {
            const equipment = $(row).find('td:nth-child(1)').text().trim();
            // Columna de Tipo de Equipo puede ser la 3 (index 2)
            const equipmentType = $(row).find('td:nth-child(3)').text().trim(); 
            // Columna de Motor puede ser la 5 (index 4)
            const engine = $(row).find('td:nth-child(5)').text().trim(); 

            if (equipment && engine) {
                data.equipment_applications.push({
                    equipment: equipment,
                    type: equipmentType,
                    engine: engine
                });
            }
        });
        
        // Intento secundario si el selector #equipment-application-table no funciona
        if (data.equipment_applications.length === 0) {
            $('.application-details table tbody tr').each((i, row) => {
                const equipment = $(row).find('td:nth-child(1)').text().trim();
                const engine = $(row).find('td:nth-child(2)').text().trim(); 
                if (equipment && engine) {
                    data.equipment_applications.push({ equipment, engine, type: 'N/A' });
                }
            });
        }

        console.log(`✅ [Donaldson] Datos extraídos: ${data.cross_references.length} refs, ${data.equipment_applications.length} aplicaciones.`);
        return data;

    } catch (error) {
        if (error.response && error.response.status === 404) {
             console.log(`⚠️ [Donaldson] Producto no encontrado (404) para ${donaldsonCode}`);
        } else {
            console.error(`❌ [Donaldson] Error scraping ${donaldsonCode}: ${error.message}`);
        }
        return data;
    }
}

/**
 * Función completa: busca + scrape (Simplificada: asume que ya tienes el código Pxxxxxx)
 */
async function getDonaldsonData(donaldsonCode) {
    console.log(`🚀 [Donaldson] Proceso completo: ${donaldsonCode}`);
    
    // NOTA: La función searchDonaldsonEquivalent fue eliminada o simplificada 
    // porque el proceso es mejor si se cruza externamente al P-code y se 
    // llama directamente a scrapeDonaldsonProductPage.
    
    // Si el código no comienza con 'P', puedes intentar buscar el equivalente aquí, 
    // pero el proceso es más complejo que un simple regex.
    
    if (!donaldsonCode.startsWith('P')) {
        console.error("❌ Se requiere un código Donaldson (Pxxxxxx) para el scraper directo.");
        return filterDataModel();
    }
    
    const productData = await scrapeDonaldsonProductPage(donaldsonCode);
    return productData;
}

module.exports = {
    // searchDonaldsonEquivalent, // Ya no es necesario si cruzas antes
    getDonaldsonData
};
