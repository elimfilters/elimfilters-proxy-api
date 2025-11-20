// ============================================================================
// ELIMFILTERS — DATA ACCESS v4.0
// Acceso unificado al Sheet Master a través de GoogleSheetsConnector.
// Provee:
//   ✔ queryBySKU()
//   ✔ queryByOEM()
//   ✔ findRow()
//   ✔ insertOrReplace()
// ============================================================================

const normalizeQuery = require("../utils/normalizeQuery");
let sheetsInstance = null;

// El motor asigna la instancia desde googleSheetsConnector.js
function setSheetsInstance(instance) {
    sheetsInstance = instance;
}

/**
 * Busca un SKU exacto
 */
async function queryBySKU(sku) {
    if (!sheetsInstance) throw new Error("Sheets instance not initialized");

    const norm = normalizeQuery(sku);
    const row = await sheetsInstance.findRowBySKU(norm);

    return row || null;
}

/**
 * Busca un OEM exacto en la columna oem_number (o equivalentes)
 */
async function queryByOEM(oem) {
    if (!sheetsInstance) throw new Error("Sheets instance not initialized");

    const norm = normalizeQuery(oem);
    const row = await sheetsInstance.findRowByOEM(norm);

    return row || null;
}

/**
 * Busca cualquier código (SKU, OEM, CROSS)
 */
async function findRow(query) {
    if (!sheetsInstance) throw new Error("Sheets instance not initialized");

    const norm = normalizeQuery(query);

    const row = await sheetsInstance.findRowByQuery(norm);

    return row || null;
}

/**
 * Insertar o actualizar fila
 */
async function insertOrReplace(data) {
    if (!sheetsInstance) throw new Error("Sheets instance not initialized");

    return sheetsInstance.replaceOrInsertRow(data);
}

module.exports = {
    setSheetsInstance,
    queryBySKU,
    queryByOEM,
    findRow,
    insertOrReplace
};
