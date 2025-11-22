// ============================================================================
// ELIMFILTERS — DATA ACCESS v4.6 (FIX FINAL DE RUTA DE MODELO)
// ============================================================================

const sheets = require("./googleSheetsConnector");
// Se eliminan todas las líneas de importación de módulos internos fallidos:
// const homologationDB = require("./homologationDB"); 

let FilterModel;
try {
    // Intenta cargar si el archivo Filter.js está en la raíz (ruta más simple)
    FilterModel = require('./Filter'); 
} catch (e) {
    try {
        // Intenta cargar si está en la ruta models/ (ruta estructurada)
        FilterModel = require('./models/Filter'); 
    } catch (e2) {
        console.error("❌ ERROR CRÍTICO DE CARGA DE MODELO:", e.message, e2.message);
        FilterModel = null; 
    }
}


/**
 * [ACTUALIZADA] Consulta principal a la base de datos maestra (3 niveles de búsqueda: Sheets -> Mongo).
 * Lógica para MongoDB y Sheets.
 */
async function queryMasterDatabase(normalized) {
    if (!normalized) return null;

    try {
        // Nivel 1: Buscar en Google Sheets
        const instance = sheets.getInstance();
        if (instance) {
            const sheetRow = await instance.findRowByQuery(normalized);
            if (sheetRow && sheetRow.found) {
                return { rawData: sheetRow, source: 'MASTER_DB' };
            }
        }
        
        // Nivel 2: Buscar en la caché de MongoDB
        if (FilterModel) {
            const mongoDoc = await FilterModel.findOne({
                $or: [
                    { primary_reference: normalized },
                    { 'cross_references.part_number': normalized }
                ]
            }).lean(); 

            if (mongoDoc) {
                console.log(`[DB] ✓ Código encontrado en caché de MongoDB.`);
                return {
                    rawData: {
                        priority_reference: mongoDoc.primary_reference,
                        duty_level: mongoDoc.duty_level,
                        filter_family: mongoDoc.filter_type, 
                        specs: mongoDoc.specs,
                        cross_reference: mongoDoc.cross_references,
                        equipment_applications: mongoDoc.equipment_applications,
                    },
                    source: 'MONGO_CACHE' 
                };
            }
        }

        return null; 
        
    } catch (err) {
        console.error("❌ queryMasterDatabase error:", err);
        return null;
    }
}

/**
 * [AÑADIDA] Guarda los datos recién scrapeados en MongoDB (Caché).
 * Lógica para guardar.
 */
async function saveScrapedData(scrapedData) {
    if (!scrapedData || !scrapedData.rawData || !FilterModel) {
        console.log("⚠️ No hay datos válidos para guardar o el modelo de DB no cargó.");
        return null;
    }
    
    const isDonaldson = scrapedData.source === 'DONALDSON_SCRAPER';
    const primaryCode = scrapedData.rawData.priority_reference;

    // Mapeo al Schema de Mongoose
    const dataToSave = {
        primary_reference: primaryCode,
        duty_level: scrapedData.rawData.duty_level,
        filter_type: scrapedData.rawData.filter_family,
        specs: scrapedData.rawData.specs,
        cross_references: scrapedData.rawData.cross_reference,
        equipment_applications: scrapedData.rawData.equipment_applications,
        is_scraped: true,
        source_url: isDonaldson ? 
            `https://shop.donaldson.com/store/en-us/product/${primaryCode}/80` : 
            `https://www.fram.com/fram-extra-guard-oil-filter-spin-on-${primaryCode.toLowerCase()}`
    };

    try {
        const savedDoc = await FilterModel.findOneAndUpdate(
            { primary_reference: primaryCode },
            { $set: dataToSave },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        console.log(`✅ Datos de filtro guardados/actualizados en caché: ${primaryCode}`);
        
        return {
            rawData: {
                priority_reference: savedDoc.primary_reference,
                duty_level: savedDoc.duty_level,
                filter_family: savedDoc.filter_type, 
                specs: savedDoc.specs,
                cross_reference: savedDoc.cross_references,
                equipment_applications: savedDoc.equipment_applications,
            },
            source: savedDoc.is_scraped ? 'MONGO_CACHE_UPDATED' : 'MONGO_CACHE'
        };

    } catch (err) {
        console.error("❌ Error CRÍTICO guardando datos scrapeados:", err);
        return null;
    }
}


// Funciones originales del archivo para exportación
async function queryBySKU(sku) { return null; }
function loadMultiEquivalences() { return {}; } 
async function loadOEMandCross(queryNorm) { return { oem: [], cross: [] }; } 


module.exports = {
    queryBySKU,
    loadMultiEquivalences,
    loadOEMandCross,
    queryMasterDatabase, 
    saveScrapedData 
};
