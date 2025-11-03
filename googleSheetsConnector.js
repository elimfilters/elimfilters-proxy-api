// =========================================
// googleSheetsConnector.js v4.1 — ELIMFILTERS
// =========================================

const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.sheetId = process.env.GOOGLE_SHEET_ID;
  }

  // Inicializa conexión con Google Sheets
  async initialize() {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    this.sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Conectado a Google Sheets:', this.sheetId);
  }

  // Buscar fila por código OEM o SKU
  async findRowByQuery(query) {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: 'Master!A2:AH'
      });

      const rows = res.data.values || [];
      const q = query.trim().toUpperCase();

      for (const row of rows) {
        const rowData = row.map(v => (v ? v.toUpperCase() : ''));
        if (rowData.includes(q)) {
          const headersRes = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.sheetId,
            range: 'Master!A1:AH1'
          });
          const headers = headersRes.data.values[0];
          const rowObj = {};
          headers.forEach((h, i) => { rowObj[h] = row[i] || ''; });
          return rowObj;
        }
      }

      return null;
    } catch (err) {
      console.error('❌ Error en findRowByQuery:', err.message);
      return null;
    }
  }

  // Añadir nueva fila con datos generados
  async appendRow(data) {
    try {
      const row = [
        data.query_norm || '',
        data.final_sku || '',
        data.family || '',
        data.duty || '',
        data.oem_codes || '',
        data.cross_reference || '',
        data.filter_type || '',
        data.media_type || '',
        data.subtype || '',
        data.engine_applications || '',
        data.equipment_applications || '',
        data.height_mm || '',
        data.outer_diameter_mm || '',
        data.thread_size || '',
        data.gasket_od_mm || '',
        data.gasket_id_mm || '',
        data.bypass_valve_psi || '',
        data.micron_rating || '',
        data.iso_main_efficiency_percent || '',
        data.iso_test_method || '',
        data.beta_200 || '',
        data.hydrostatic_burst_psi || '',
        data.dirt_capacity_grams || '',
        data.rated_flow_cfm || '',
        data.rated_flow_gpm || '',
        data.panel_width_mm || '',
        data.panel_depth_mm || '',
        data.manufacturing_standards || '',
        data.certification_standards || '',
        data.operating_pressure_min_psi || '',
        data.operating_pressure_max_psi || '',
        data.operating_temperature_min_c || '',
        data.operating_temperature_max_c || '',
        data.fluid_compatibility || '',
        data.disposal_method || '',
        data.weight_grams || '',
        data.category || '',
        data.name || '',
        data.description || ''
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: 'Master!A:AH',
        valueInputOption: 'RAW',
        requestBody: { values: [row] }
      });

      console.log(`✅ Nuevo registro agregado: ${data.final_sku}`);
      return true;
    } catch (err) {
      console.error('❌ Error al agregar fila:', err.message);
      return false;
    }
  }
}

module.exports = GoogleSheetsService;
