// googleSheetsConnector.js
// Servicio para conectarse a Google Sheets y exponer utilidades básicas.
// Mapea siempre las filas a una lista EXPECTED_HEADERS fija (proporcionada abajo).

const { google } = require('googleapis');

class GoogleSheetsService {
  /**
   * @param {Object} options
   * @param {Object} options.credentials - JSON credentials object for service account
   * @param {string} options.sheetId - Google Sheet ID
   * @param {string} [options.range='Master!A1:Z'] - default range to read
   */
  constructor({ credentials, sheetId, range = 'Master!A1:Z' }) {
    if (!credentials) throw new Error('Google credentials are required');
    if (!sheetId) throw new Error('SHEET ID is required');
    this.credentials = credentials;
    this.sheetId = sheetId;
    this.range = range;
    this.sheets = null;
  }

  // Lista CANÓNICA Y ORDENADA de columnas que quieres que siempre aparezcan
  static EXPECTED_HEADERS() {
    return [
      'query_norm','sku','family','duty','oem_codes','cross_reference','filter_type','media_type','subtype',
      'engine_applications','equipment_applications','height_mm','outer_diameter_mm','thread_size','gasket_od_mm',
      'gasket_id_mm','bypass_valve_psi','micron_rating','iso_main_efficiency_percent','iso_test_method','beta_200',
      'hydrostatic_burst_psi','dirt_capacity_grams','rated_flow_cfm','rated_flow_gpm','panel_width_mm','panel_depth_mm',
      'manufacturing_standards','certification_standards','operating_pressure_min_psi','operating_pressure_max_psi',
      'operating_temperature_min_c','operating_temperature_max_c','fluid_compatibility','disposal_method','weight_grams'
    ];
  }

  async initializeAuth() {
    if (this.sheets) return;
    const auth = new google.auth.GoogleAuth({
      credentials: this.credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const authClient = await auth.getClient();
    this.sheets = google.sheets({ version: 'v4', auth: authClient });
  }

  // Lee la hoja y devuelve headers reales y filas
  async fetchRaw(range = this.range) {
    await this.initializeAuth();
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const values = res.data.values || [];
    if (values.length === 0) return { headers: [], rows: [] };
    const headers = values[0].map(h => (h || '').toString().trim());
    const rows = values.slice(1);
    return { headers, rows };
  }

  // Mapea una fila (array) a un objeto usando headers pasados
  mapRowToObject(headers, row) {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i] || `col_${i}`;
      obj[key] = row[i] !== undefined ? row[i] : null;
    }
    return obj;
  }

  // Construye objeto con el ORDEN y las claves de EXPECTED_HEADERS, usando los valores de la hoja si están
  mapRowToExpected(row, actualHeaders) {
    const lowerActual = actualHeaders.map(h => (h || '').toLowerCase());
    const expected = GoogleSheetsService.EXPECTED_HEADERS();
    const obj = {};
    for (const key of expected) {
      // intentar encontrar índice en actualHeaders coincidente (insensible a mayúsculas)
      const idx = lowerActual.indexOf((key || '').toLowerCase());
      if (idx !== -1) {
        obj[key] = row[idx] !== undefined ? row[idx] : null;
      } else {
        // No existe la columna en la hoja -> null
        obj[key] = null;
      }
    }
    return obj;
  }

  // Devuelve todos los productos mapeados con EXPECTED_HEADERS
  async getProducts() {
    const { headers, rows } = await this.fetchRaw();
    const products = rows.map(row => this.mapRowToExpected(row, headers));
    return products;
  }

  // Obtener producto por sku (busca la columna 'sku' en headers)
  async getProductById(id) {
    if (id === undefined || id === null) return null;
    const { headers, rows } = await this.fetchRaw();

    // buscar columna sku (insensible a mayúsculas)
    const lower = headers.map(h => (h || '').toLowerCase());
    let skuIndex = lower.indexOf('sku');
    if (skuIndex === -1) {
      // fallback: primera columna
      skuIndex = 0;
    }

    for (const row of rows) {
      const val = row[skuIndex];
      if (val !== undefined && String(val) === String(id)) {
        return this.mapRowToExpected(row, headers);
      }
    }
    return null;
  }

  // Búsqueda simple por texto en todas las columnas; devuelve objetos mapeados a EXPECTED_HEADERS
  async search(query, limit = 50) {
    if (!query) return [];
    const q = String(query).toLowerCase();
    const { headers, rows } = await this.fetchRaw();
    const results = [];
    for (const row of rows) {
      // combinar values en un string para búsqueda
      const anyMatch = row.some(cell => {
        if (cell === null || cell === undefined) return false;
        return String(cell).toLowerCase().includes(q);
      });
      if (anyMatch) {
        results.push(this.mapRowToExpected(row, headers));
        if (results.length >= limit) break;
      }
    }
    return results;
  }
}

module.exports = GoogleSheetsService;
