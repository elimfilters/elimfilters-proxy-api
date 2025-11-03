/**
 * ELIMFILTERS Google Sheets Connector v3.3.2
 * Gestiona búsqueda, inserción y actualización en la hoja Master
 */

const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.sheetId = process.env.GOOGLE_SHEET_ID;
  }

  async initialize() {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
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

  /**
   * Busca una fila por código de filtro o SKU
   */
  async findRowByQuery(query) {
    try {
      const range = 'Master!A2:AJ'; // Ajusta si tu hoja tiene más columnas
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range,
      });

      const rows = res.data.values || [];
      const headers = [
        'query_norm', 'sku', 'family', 'duty', 'oem_codes', 'cross_reference',
        'filter_type', 'media_type', 'subtype', 'engine_applications', 'equipment_applications',
        'height_mm', 'outer_diameter_mm', 'thread_size', 'gasket_od_mm', 'gasket_id_mm',
        'bypass_valve_psi', 'micron_rating', 'iso_main_efficiency_percent', 'iso_test_method',
        'beta_200', 'hydrostatic_burst_psi', 'dirt_capacity_grams', 'rated_flow_cfm',
        'rated_flow_gpm', 'panel_width_mm', 'panel_depth_mm', 'manufacturing_standards',
        'certification_standards', 'operating_pressure_min_psi', 'operating_pressure_max_psi',
        'operating_temperature_min_c', 'operating_temperature_max_c', 'fluid_compatibility',
        'disposal_method', 'weight_grams', 'category', 'name', 'description'
      ];

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
   * Añade una nueva fila a la hoja Master
   */
  async appendRow(rowArray) {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: 'Master!A2',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowArray] },
      });
      console.log('✅ Nueva fila añadida a la hoja Master.');
    } catch (err) {
      console.error('❌ Error al añadir fila a Sheets:', err.message);
    }
  }

  /**
   * Actualiza una fila incompleta si ya existe pero tiene datos vacíos
   */
  async updateRowIfIncomplete(query, updatedData) {
    try {
      const range = 'Master!A2:AJ';
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range,
      });

      const rows = res.data.values || [];
      const headers = [
        'query_norm', 'sku', 'family', 'duty', 'oem_codes', 'cross_reference',
        'filter_type', 'media_type', 'subtype', 'engine_applications', 'equipment_applications',
        'height_mm', 'outer_diameter_mm', 'thread_size', 'gasket_od_mm', 'gasket_id_mm',
        'bypass_valve_psi', 'micron_rating', 'iso_main_efficiency_percent', 'iso_test_method',
        'beta_200', 'hydrostatic_burst_psi', 'dirt_capacity_grams', 'rated_flow_cfm',
        'rated_flow_gpm', 'panel_width_mm', 'panel_depth_mm', 'manufacturing_standards',
        'certification_standards', 'operating_pressure_min_psi', 'operating_pressure_max_psi',
        'operating_temperature_min_c', 'operating_temperature_max_c', 'fluid_compatibility',
        'disposal_method', 'weight_grams', 'category', 'name', 'description'
      ];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row[0].toUpperCase() === query || row[1].toUpperCase() === query) {
          let updatedRow = [...row];
          headers.forEach((header, idx) => {
            if (!updatedRow[idx] && updatedData[header]) {
              updatedRow[idx] = updatedData[header];
            }
          });

          const rangeToUpdate = `Master!A${i + 2}:AJ${i + 2}`;
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.sheetId,
            range: rangeToUpdate,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [updatedRow] },
          });

          console.log(`🟡 Fila existente actualizada: ${query}`);
          return;
        }
      }
    } catch (err) {
      console.error('❌ Error al actualizar fila:', err.message);
    }
  }
}

module.exports = GoogleSheetsService;
