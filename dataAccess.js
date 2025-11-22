// ============================================================================
// ELIMFILTERS — DATA ACCESS LAYER (Google Sheets)
// Manejo de lectura, escritura, actualización y logging de unknown codes.
// ============================================================================

const sheets = require("./googleSheetsConnector");
const rulesProtection = require("./rulesProtection");

// ============================================================================
// NORMALIZAR COLUMNAS VACÍAS
// ============================================================================
function clean(obj) {
  const out = {};
  for (const k in obj) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
      out[k] = obj[k];
    }
  }
  return out;
}

// ============================================================================
// BUSCAR POR SKU (consulta directa)
// ============================================================================
async function queryBySKU(sku) {
  const row = await sheets.findRowBySKU(sku);
  return row || null;
}

// ============================================================================
// BUSCAR POR OEM O CROSS → retornar fila existente si existe
// ============================================================================
async function queryByOEMorCross(code) {
  return await sheets.findRowByOEM(code);
}

// ============================================================================
// GUARDAR / ACTUALIZAR FILA COMPLETA (UPSERT REAL)
// ============================================================================
async function saveFullRecord(record) {
  if (!record || !record.query_norm) {
    throw new Error("saveFullRecord requiere query_norm");
  }

  const cleanRecord = clean(record);

  // Buscar si existe
  const existing = await sheets.findRowByQueryNorm(record.query_norm);

  let finalRecord = null;
  let changed = false;

  if (existing) {
    // Mezclar información respetando protecciones
    const { record: merged, changed: diff } = rulesProtection.applyProtectionRules(
      existing,
      cleanRecord
    );

    finalRecord = merged;
    changed = diff;

    await sheets.updateRow(existing._rowIndex, finalRecord);
  } else {
    // Insertar nueva fila
    finalRecord = cleanRecord;
    await sheets.insertRow(finalRecord);
    changed = true;
  }

  return { ok: true, changed, record: finalRecord };
}

// ============================================================================
// GUARDAR CÓDIGO DESCONOCIDO PARA HOMOLOGACIÓN
// ============================================================================
async function logUnknownCode(code) {
  try {
    await sheets.saveUnknownCode(code);
    return true;
  } catch (e) {
    console.error("[dataAccess] Error guardando unknown code:", e);
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  queryBySKU,
  queryByOEMorCross,
  saveFullRecord,
  logUnknownCode
};
