const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
    this.sheetId = process.env.GOOGLE_SHEET_ID;
    this.client = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    this.sheets = google.sheets({ version: 'v4', auth: this.client });
  }

  async initialize() {
    try {
      await this.client.authorize();
      console.log('✅ Google Sheets autorizado');
    } catch (err) {
      console.error('❌ Error al autorizar Google Sheets:', err.message);
      throw err;
    }
  }

  // Buscar fila existente por SKU o query_norm
  async findRowBySKU(query) {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: 'Master!A2:AZ',
      });
      const rows = res.data.values || [];
      const header = [
        'query_norm','sku','family','duty','oem_codes','cross_reference','filter_type',
        'media_type','subtype','engine_applications','equipment_applications','height_mm',
        'outer_diameter_mm','thread_size','gasket_od_mm','gasket_id_mm','bypass_valve_psi',
        'micron_rating','iso_main_efficiency_percent','iso_test_method','beta_200',
        'hydrostatic_burst_psi','dirt_capacity_grams','rated_flow_cfm','rated_flow_gpm',
        'panel_width_mm','panel_depth_mm','manufacturing_standards','certification_standards',
        'operating_pressure_min_psi','operating_pressure_max_psi','operating_temperature_min_c',
        'operating_temperature_max_c','fluid_compatibility','disposal_method','weight_grams',
        'category','name','description'
      ];

      for (const row of rows) {
        const sku = row[1] || '';
        const qn = row[0] || '';
        if (sku.toUpperCase() === query.toUpperCase() || qn.toUpperCase() === query.toUpperCase()) {
          const data = {};
          header.forEach((key, i) => data[key] = row[i] || '');
          return data;
        }
      }
      return null;
    } catch (err) {
      console.error('❌ Error buscando en hoja Master:', err.message);
      return null;
    }
  }

  // Insertar nueva fila
  async appendRow(obj) {
    try {
      const header = [
        'query_norm','sku','family','duty','oem_codes','cross_reference','filter_type',
        'media_type','subtype','engine_applications','equipment_applications','height_mm',
        'outer_diameter_mm','thread_size','gasket_od_mm','gasket_id_mm','bypass_valve_psi',
        'micron_rating','iso_main_efficiency_percent','iso_test_method','beta_200',
        'hydrostatic_burst_psi','dirt_capacity_grams','rated_flow_cfm','rated_flow_gpm',
        'panel_width_mm','panel_depth_mm','manufacturing_standards','certification_standards',
        'operating_pressure_min_psi','operating_pressure_max_psi','operating_temperature_min_c',
        'operating_temperature_max_c','fluid_compatibility','disposal_method','weight_grams',
        'category','name','description'
      ];

      const row = header.map((key) => obj[key] || '');
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: 'Master!A:AZ',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      });
      console.log(`🧾 Nuevo registro agregado: ${obj.sku}`);
    } catch (err) {
      console.error('❌ Error insertando fila:', err.message);
    }
  }
}

module.exports = GoogleSheetsService;
