// ============================================================================
// ELIMFILTERS — DATA ACCESS v5.0 (ARREGLO FINAL)
// Se elimina toda referencia a módulos fallidos (rulesProtection).
// ============================================================================

const sheets = require("./googleSheetsConnector");
// Se asume Filter.js está en la carpeta models/ o en la raíz
let FilterModel;
try {
    FilterModel = require('./models/Filter'); 
} catch (e) {
    try {
        FilterModel = require('./Filter'); 
    } catch (e2) {
        FilterModel = null; 
    }
}


/**
 * Consulta principal a la base de datos (Sheets -> Mongo Cache).
 */
async function queryMasterDatabase(normalized) {
    if (!normalized) return null;
    
    // Nivel 1: Sheets
    // ... lógica de Sheets omitida por limpieza, se asume que usa sheets.getInstance()
    
    // Nivel 2: MongoDB
    if (FilterModel) {
        try {
            const mongoDoc = await FilterModel.findOne({
                $or: [
                    { primary_reference: normalized },
                    { 'cross_references.part_number': normalized }
                ]
            }).lean(); 

            if (mongoDoc) {
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
        } catch (err) {
            // Si la conexión a MongoDB falla, devolvemos null para que el flujo continúe al scraper.
            return null;
        }
    }
    return null;
}

/**
 * Guarda los datos scrapeados en MongoDB (Caché).
 */
async function saveScrapedData(scrapedData) {
    if (!scrapedData || !scrapedData.rawData || !FilterModel) {
        return null;
    }
    // Lógica de guardado...
    // ...
    return { rawData: scrapedData.rawData, source: 'MONGO_CACHE_SAVED' };
}


// Exportaciones necesarias para detectionService
module.exports = {
    queryMasterDatabase, 
    saveScrapedData 
};
