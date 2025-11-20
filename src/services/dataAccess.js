// ============================================================================
// ELIMFILTERS — DATA ACCESS v4.2
// Acceso centralizado a los datos del Sheet Master y equivalencias.
// ============================================================================

const sheets = require("./googleSheetsConnector");
const homologationDB = require("./homologationDB");

/**
 * Busca un SKU directamente en el Master.
 * Devuelve:
 *   - null si no existe
 *   - objeto completo si existe
 */
async function queryBySKU(sku) {
    if (!sku) return null;

    try {
        const instance = sheets.getInstance();
        if (!instance) return null;

        const queryNorm = sku.trim().toUpperCase();
        const row = await instance.findRowByQuery(queryNorm);

        if (!row || !row.found) return null;

        return row;   
    } catch (err) {
        console.error("❌ queryBySKU error:", err);
        return null;
    }
}

/**
 * Carga equivalencias múltiples desde homologation_multi.json
 * (Registro completo para debugging y reportes)
 */
function loadMultiEquivalences() {
    return homologationDB.loadMulti();
}

/**
 * Devuelve un objeto compacto con:
 * - oem_codes[]
 * - cross_reference[]
 */
async function loadOEMandCross(queryNorm) {
    try {
        const instance = sheets.getInstance();
        if (!instance) return { oem: [], cross: [] };

        const row = await instance.findRowByQuery(queryNorm);
        if (!row || !row.found) return { oem: [], cross: [] };

        const oem = Array.isArray(row.oem_codes)
            ? row.oem_codes
            : String(row.oem_codes || "").split(/[,\n\r]+/).filter(Boolean);

        const cross = Array.isArray(row.cross_reference)
            ? row.cross_reference
            : String(row.cross_reference || "").split(/[,\n\r]+/).filter(Boolean);

        return { oem, cross };
    } catch (err) {
        console.error("❌ loadOEMandCross error:", err);
        return { oem: [], cross: [] };
    }
}

module.exports = {
    queryBySKU,
    loadMultiEquivalences,
    loadOEMandCross
};
