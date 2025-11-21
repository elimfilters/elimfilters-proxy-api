// ============================================================================
// ELIMFILTERS — Google Sheets Connector (FINAL VERSION)
// Compatible con Railway, Service Account, Master Sheet y motor nuevo
// ============================================================================

const { google } = require("googleapis");

// Sanitizar PRIVATE KEY (soluciona errores por saltos de línea)
function fixKey(key) {
  return key.replace(/\\n/g, "\n");
}

class GoogleSheetsService {
  constructor() {
    this.doc = null;
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    this.sheetName = process.env.SHEET_NAME || "Master";

    if (!this.spreadsheetId) {
      console.error("❌ No existe GOOGLE_SHEETS_SPREADSHEET_ID");
    }
  }

  // ============================================================================
  // Inicializar conexión con Google Sheets
  // ============================================================================
  async initialize() {
    try {
      const auth = new google.auth.JWT(
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        null,
        fixKey(process.env.GOOGLE_PRIVATE_KEY),
        ["https://www.googleapis.com/auth/spreadsheets"]
      );

      this.sheets = google.sheets({ version: "v4", auth });

      console.log("✅ GoogleSheetsService inicializado");
      return true;
    } catch (err) {
      console.error("❌ Error inicializando Sheets:", err);
      return false;
    }
  }

  // ============================================================================
  // Leer encabezados de la hoja
  // ============================================================================
  async getHeaders() {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!1:1`,
      });

      return res.data.values?.[0] || [];
    } catch (err) {
      console.error("❌ Error obteniendo encabezados:", err);
      return [];
    }
  }

  // ============================================================================
  // Asegurar que el Master Sheet tiene todas las columnas necesarias
  // ============================================================================
  async ensureMasterHeaders() {
    const requiredHeaders = [
      "query_norm", "sku", "description", "family", "duty",
      "oem_codes", "cross_reference", "media_type", "filter_type", "subtype",
      "engine_applications", "equipment_applications",
      "height_mm", "outer_diameter_mm", "thread_size",
      "gasket_od_mm", "gasket_id_mm", "bypass_valve_psi",
      "micron_rating", "iso_main_efficiency_percent", "iso_test_method",
      "beta_200", "hydrostatic_burst_psi", "dirt_capacity_grams",
      "rated_flow_cfm", "rated_flow_gpm", "panel_width_mm", "panel_depth_mm",
      "manufacturing_standards", "certification_standards",
      "operating_pressure_min_psi", "operating_pressure_max_psi",
      "operating_temperature_min_c", "operating_temperature_max_c",
      "fluid_compatibility", "disposal_method",
      "weight_grams", "service_life_hours", "change_interval_km",
      "water_separation_efficiency_percent", "drain_type",
      "oem_number", "cross_brand", "cross_part_number",
      "manufactured_by", "last4_source", "last4_digits",
      "source", "homologated_sku", "review",
      "all_cross_references", "specs",
      "priority_reference", "priority_brand_reference",
      "ok"
    ];

    const current = await this.getHeaders();
    if (current.length === 0) {
      console.log("⚠️ Hoja vacía → creando encabezados...");

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!1:1`,
        valueInputOption: "RAW",
        requestBody: { values: [requiredHeaders] },
      });

      console.log("✅ Encabezados creados");
      return true;
    }

    // Faltantes
    const missing = requiredHeaders.filter(h => !current.includes(h));
    if (missing.length === 0) return true;

    console.log("⚠️ Agregando columnas faltantes →", missing);

    const finalHeaders = [...current, ...missing];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!1:1`,
      valueInputOption: "RAW",
      requestBody: { values: [finalHeaders] },
    });

    console.log("✅ Encabezados actualizados");
    return true;
  }

  // ============================================================================
  // Buscar FILA por query_norm
  // ============================================================================
  async findRowByQuery(queryNorm) {
    try {
      const headers = await this.getHeaders();
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: this.sheetName,
      });

      const rows = res.data.values || [];
      const qIndex = headers.indexOf("query_norm");

      if (qIndex < 0) return null;

      for (let i = 1; i < rows.length; i++) {
        if ((rows[i][qIndex] || "").toUpperCase() === queryNorm.toUpperCase()) {
          const rowObj = {};
          headers.forEach((h, idx) => {
            rowObj[h] = rows[i][idx] || "";
          });
          return { found: true, ...rowObj };
        }
      }

      return null;
    } catch (err) {
      console.error("❌ Error leyendo fila:", err);
      return null;
    }
  }

  // ============================================================================
  // Insertar o reemplazar fila completa
  // ============================================================================
  async replaceOrInsertRow(rowObj) {
    try {
      const headers = await this.getHeaders();
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: this.sheetName,
      });

      const rows = res.data.values || [];
      const qIndex = headers.indexOf("query_norm");

      if (qIndex < 0) return false;

      const queryNorm = rowObj.query_norm.toUpperCase();

      // Buscar si existe
      for (let i = 1; i < rows.length; i++) {
        const val = (rows[i][qIndex] || "").toUpperCase();
        if (val === queryNorm) {
          // Reemplazar fila
          const rowData = headers.map(h => rowObj[h] ?? "");
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!${i + 1}:${i + 1}`,
            valueInputOption: "RAW",
            requestBody: { values: [rowData] },
          });
          return true;
        }
      }

      // Insertar nueva
      const rowData = headers.map(h => rowObj[h] ?? "");
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: this.sheetName,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [rowData] },
      });

      return true;
    } catch (err) {
      console.error("❌ Error replaceOrInsertRow:", err);
      return false;
    }
  }

  // ============================================================================
  // Guardar referencia cruzada OEM → Marca
  // ============================================================================
  async saveCrossReference(oem_number, brand, part_number, family) {
    try {
      const row = {
        query_norm: oem_number,
        oem_number,
        cross_brand: brand,
        cross_part_number: part_number,
        family,
        source: "CROSS_REGISTER"
      };

      return await this.replaceOrInsertRow(row);
    } catch (err) {
      console.error("❌ Error saveCrossReference:", err);
      return false;
    }
  }

  // ============================================================================
  // Stats para /health/master
  // ============================================================================
  getPendingWritesStats() {
    return { exists: false, count: 0 };
  }

  async shutdown() {
    return true;
  }
}

module.exports = GoogleSheetsService;

