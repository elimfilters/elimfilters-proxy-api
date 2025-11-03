/**
 * ELIMFILTERS Google Sheets Connector v3.3.4
 * Versión con validación condicional de campos técnicos según tipo de filtro.
 */

const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    // Aseguramos que la variable de entorno se llama GOOGLE_SHEETS_ID según la imagen de variables que enviaste.
    this.sheetId = process.env.GOOGLE_SHEETS_ID; 
  }

  async initialize() {
    try {
        // Asumiendo que GOOGLE_PRIVATE_KEY contiene las credenciales JSON completas
      const credentials = JSON.parse(process.env.GOOGLE_PRIVATE_KEY); 
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const client = await auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: client });
      console.log('✅ Google Sheets conectado correctamente.');
    } catch (err) {
      console.error('❌ Error al inicializar Google Sheets:', err.message);
      throw err;
    }
  }

  async findRowByQuery(query) {
    try {
      const range = 'Master!A2:AJ';
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range,
      });

      const rows = res.data.values || [];
      const headers = this.getHeaders();

      for (const row of rows) {
        const rowObj = {};
        headers.forEach((h, i) => (rowObj[h] = row[i] || ''));

        if (
          rowObj.query_norm.toUpperCase() === query ||
          rowObj.sku.toUpperCase() === query ||
          (rowObj.oem_codes && rowObj.oem_codes.toUpperCase().includes(query)) ||
          (rowObj.cross_reference && rowObj.cross_reference.toUpperCase().includes(query))
        ) {
          console.log(`✅ Coincidencia encontrada en Google Sheets: ${query}`);
          return rowObj;
        }
      }
      return null;
    } catch (err) {
      console.error('❌ Error en findRowByQuery:', err.message);
      return null;
    }
  }

  /**
   * Inserta o reemplaza una fila completa validando campos según tipo de filtro.
   */
  async replaceOrInsertRow(data) {
    try {
      const range = 'Master!A2:AJ';
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range,
      });

      const headers = this.getHeaders();
      const validated = this.validateByFilterType(data);

      const rowArray = headers.map((key) => validated[key] || '');

      const rows = res.data.values || [];
      let rowIndex = -1;

      for (let i = 0; i < rows.length; i++) {
        if (
          rows[i][0]?.toUpperCase() === data.query_norm?.toUpperCase() ||
          rows[i][1]?.toUpperCase() === data.sku?.toUpperCase()
        ) {
          rowIndex = i + 2;
          break;
        }
      }

      if (rowIndex > 0) {
        const rangeToUpdate = `Master!A${rowIndex}:AJ${rowIndex}`;
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: rangeToUpdate,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [rowArray] },
        });
        console.log(`🟡 Fila reemplazada correctamente: ${data.query_norm}`);
      } else {
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.sheetId,
          range: 'Master!A2',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [rowArray] },
        });
        console.log(`🟢 Nueva fila añadida: ${data.query_norm}`);
      }
    } catch (err) {
      console.error('❌ Error en replaceOrInsertRow:', err.message);
    }
  }

  /**
   * Define las cabeceras fijas
   */
  getHeaders() {
    return [
      'query_norm','sku','family','duty','oem_codes','cross_reference','filter_type','media_type','subtype',
      'engine_applications','equipment_applications','height_mm','outer_diameter_mm','thread_size',
      'gasket_od_mm','gasket_id_mm','bypass_valve_psi','micron_rating','iso_main_efficiency_percent',
      'iso_test_method','beta_200','hydrostatic_burst_psi','dirt_capacity_grams','rated_flow_cfm',
      'rated_flow_gpm','panel_width_mm','panel_depth_mm','manufacturing_standards','certification_standards',
      'operating_pressure_min_psi','operating_pressure_max_psi','operating_temperature_min_c',
      'operating_temperature_max_c','fluid_compatibility','disposal_method','weight_grams','category','name','description'
    ];
  }

  /**
   * Valida los campos según el tipo de filtro
   */
  validateByFilterType(data) {
    const allowed = { ...data };
    const family = (data.family || '').toUpperCase();

    const fieldsByType = {
      AIR: ['height_mm','outer_diameter_mm','panel_width_mm','panel_depth_mm'],
      OIL: ['height_mm','outer_diameter_mm','thread_size','micron_rating','bypass_valve_psi'],
      HYDRAULIC: ['height_mm','outer_diameter_mm','thread_size','micron_rating','hydrostatic_burst_psi'],
      CABIN: ['panel_width_mm','panel_depth_mm','height_mm'],
      SEPARATOR: ['height_mm','outer_diameter_mm','rated_flow_gpm','rated_flow_cfm'],
      TURBINE: ['height_mm','outer_diameter_mm','rated_flow_gpm','rated_flow_cfm'],
    };

    const validFields = fieldsByType[family] || [];
    const allTechFields = [
      'height_mm','outer_diameter_mm','thread_size','panel_width_mm','panel_depth_mm',
      'micron_rating','bypass_valve_psi','hydrostatic_burst_psi','rated_flow_cfm','rated_flow_gpm'
    ];

    // Vacía los no aplicables
    for (const key of allTechFields) {
      if (!validFields.includes(key)) allowed[key] = '';
    }

    return allowed;
  }
}

module.exports = GoogleSheetsService;
