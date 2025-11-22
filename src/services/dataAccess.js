// ============================================================================
// ELIMFILTERS — DATA ACCESS v4.5 (CORRECCIÓN DE FALLO CRÍTICO)
// Acceso centralizado a los datos del Sheet Master y equivalencias.
// ============================================================================

const sheets = require("./googleSheetsConnector");
// const homologationDB = require("./homologationDB"); // <-- LÍNEA ELIMINADA: Corrige el error "Cannot find module"
const FilterModel = require('./models/Filter'); 
// NOTA: Si su archivo de modelo (Filter.js) está en la raíz, use require('./Filter').


/**
 * [ACTUALIZADA] Consulta principal a la base de datos maestra (3 niveles de búsqueda: Sheets -> Mongo).
 * @param {string} normalized Código normalizado.
 * @returns {object} { rawData: {...}, source: 'MASTER_DB' | 'MONGO_CACHE' }
 */
async function queryMasterDatabase(normalized) {
    if (!normalized) return null;

    try {
        // Nivel 1: Buscar en Google Sheets (Fuente Primaria)
        const instance = sheets.getInstance();
        if (instance) {
            const sheetRow = await instance.findRowByQuery(normalized);
            if (sheetRow && sheetRow.found) {
                return {
                    rawData: sheetRow,
                    source: 'MASTER_DB'
                };
            }
        }
        
        // Nivel 2: Buscar en la caché de MongoDB 
        const mongoDoc = await FilterModel.findOne({
            $or: [
                { primary_reference: normalized },
                { 'cross_references.part_number': normalized }
            ]
        }).lean(); 

        if (mongoDoc) {
             console.log(`[DB] ✓ Código encontrado en caché de MongoDB.`);
             
             // Mapeo del documento de Mongo al formato rawData esperado
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

        return null; 
        
    } catch (err) {
        console.error("❌ queryMasterDatabase error:", err);
        return null;
    }
}

/**
 * [AÑADIDA] Guarda los datos recién scrapeados en MongoDB (Caché).
 */
async function saveScrapedData(scrapedData) {
    if (!scrapedData || !scrapedData.rawData) {
        console.log("⚠️ No hay datos válidos para guardar.");
        return null;
    }
    
    const isDonaldson = scrapedData.source === 'DONALDSON_SCRAPER';
    const primaryCode = scrapedData.rawData.priority_reference;

    // Mapeamos los datos del scraper al Mongoose Schema
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


/**
 * Funciones originales del archivo (simplemente retornan null/array vacío para evitar el error de módulo faltante)
 */

async function queryBySKU(sku) { 
    return null;
}

function loadMultiEquivalences() { 
    return {};
} 

async function loadOEMandCross(queryNorm) {
    return { oem: [], cross: [] };
} 


module.exports = {
    queryBySKU,
    loadMultiEquivalences,
    loadOEMandCross,
    queryMasterDatabase, 
    saveScrapedData 
};
