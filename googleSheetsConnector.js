// googleSheetsConnector.js
// Servicio Google Sheets - mapea a EXPECTED_HEADERS, categorías y expone utilidades.
// CommonJS

const { google } = require('googleapis');

class GoogleSheetsService {
  constructor({ credentials, sheetId, range = 'Master!A1:Z' }) {
    if (!credentials) throw new Error('Google credentials are required');
    if (!sheetId) throw new Error('SHEET ID is required');
    this.credentials = credentials;
    this.sheetId = sheetId;
    this.range = range;
    this.sheets = null;
  }

  // Lista canónica esperada (puedes modificarla)
  static EXPECTED_HEADERS() {
    return [
      'query_norm','sku','family','duty','oem_codes','cross_reference','filter_type','media_type','subtype',
      'engine_applications','equipment_applications','height_mm','outer_diameter_mm','thread_size','gasket_od_mm',
      'gasket_id_mm','bypass_valve_psi','micron_rating','iso_main_efficiency_percent','iso_test_method','beta_200',
      'hydrostatic_burst_psi','dirt_capacity_grams','rated_flow_cfm','rated_flow_gpm','panel_width_mm','panel_depth_mm',
      'manufacturing_standards','certification_standards','operating_pressure_min_psi','operating_pressure_max_psi',
      'operating_temperature_min_c','operating_temperature_max_c','fluid_compatibility','disposal_method','weight_grams',
      'category','name','description'
    ];
  }

  // Mapa por categoría: campos relevantes (puedes editar según necesites)
  static CATEGORY_SPEC_MAP() {
    return {
      air: ['sku','name','family','filter_type','media_type','subtype','engine_applications','equipment_applications','height_mm','outer_diameter_mm','rated_flow_cfm','panel_width_mm','panel_depth_mm','weight_grams'],
      cabin: ['sku','name','family','filter_type','media_type','height_mm','outer_diameter_mm','micron_rating','iso_main_efficiency_percent','operating_temperature_min_c','operating_temperature_max_c','weight_grams'],
      liquid_cartucho: ['sku','name','family','filter_type','media_type','micron_rating','beta_200','rated_flow_gpm','dirt_capacity_grams','hydrostatic_burst_psi','operating_pressure_min_psi','operating_pressure_max_psi','fluid_compatibility','weight_grams'],
      liquid_spinon: ['sku','name','family','filter_type','thread_size','gasket_od_mm','gasket_id_mm','micron_rating','rated_flow_gpm','dirt_capacity_grams','weight_grams'],
      turbine: ['sku','name','family','manufacturing_standards','certification_standards','operating_pressure_min_psi','operating_pressure_max_psi','rated_flow_cfm','weight_grams','description'],
      housing: ['sku','name','family','outer_diameter_mm','height_mm','thread_size','manufacturing_standards','weight_grams'],
      default: GoogleSheetsService.EXPECTED_HEADERS()
    };
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

  // Devuelve los headers detectados (tal cual en la hoja)
  async getDetectedHeaders() {
    const { headers } = await this.fetchRaw();
    return headers;
  }

  indexOfHeader(headers, key) {
    const lower = headers.map(h => (h || '').toLowerCase());
    return lower.indexOf((key || '').toLowerCase());
  }

  mapRowToExpected(row, actualHeaders) {
    const expected = GoogleSheetsService.EXPECTED_HEADERS();
    const lowerActual = actualHeaders.map(h => (h || '').toLowerCase());
    const obj = {};
    for (const key of expected) {
      const idx = lowerActual.indexOf((key || '').toLowerCase());
      obj[key] = (idx !== -1 && row[idx] !== undefined) ? row[idx] : null;
    }
    // fallback detection for product_type alias
    if (!obj.category) {
      const alt = this.indexOfHeader(actualHeaders, 'product_type');
      if (alt !== -1) obj.category = row[alt] || null;
    }
    return obj;
  }

  normalizeCategory(cat) {
    if (!cat) return 'default';
    const s = String(cat).toLowerCase().trim();
    if (['air','aire','air_filter','filtro_aire'].includes(s)) return 'air';
    if (['cabin','cabina','cabin_filter'].includes(s)) return 'cabin';
    if (['liquid_cartucho','cartucho','liquidos_cartucho'].includes(s)) return 'liquid_cartucho';
    if (['liquid_spinon','spin-on','spinon','liquidos_spinon'].includes(s)) return 'liquid_spinon';
    if (['turbine','turbina','turbo'].includes(s)) return 'turbine';
    if (['housing','carcasa','carcazas','casing'].includes(s)) return 'housing';
    return s;
  }

  buildSpecsFromMapped(mappedObj) {
    const rawCategory = (mappedObj.category || '').toString().trim().toLowerCase();
    const normalized = this.normalizeCategory(rawCategory);
    const map = GoogleSheetsService.CATEGORY_SPEC_MAP();
    const allowed = map[normalized] || map.default;
    const specs = {};
    for (const key of allowed) {
      specs[key] = mappedObj.hasOwnProperty(key) ? mappedObj[key] : null;
    }
    return { category: normalized, specs };
  }

  async getProducts({ category = null, limit = 1000 } = {}) {
    const { headers, rows } = await this.fetchRaw();
    const out = [];
    for (const row of rows) {
      const mapped = this.mapRowToExpected(row, headers);
      const { category: mappedCategory, specs } = this.buildSpecsFromMapped(mapped);
      if (category && mappedCategory !== String(category).toLowerCase()) continue;
      out.push({
        meta: { sku: mapped.sku || null, name: mapped.name || null, family: mapped.family || null, category: mappedCategory },
        specs,
        raw: mapped
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  async getProductById(id) {
    if (!id) return null;
    const { headers, rows } = await this.fetchRaw();
    const skuIdx = this.indexOfHeader(headers, 'sku') !== -1 ? this.indexOfHeader(headers, 'sku') : 0;
    for (const row of rows) {
      const val = row[skuIdx];
      if (val !== undefined && String(val) === String(id)) {
        const mapped = this.mapRowToExpected(row, headers);
        const { category, specs } = this.buildSpecsFromMapped(mapped);
        return { meta: { sku: mapped.sku || null, name: mapped.name || null, family: mapped.family || null, category }, specs, raw: mapped };
      }
    }
    return null;
  }

  getSchemas() {
    return GoogleSheetsService.CATEGORY_SPEC_MAP();
  }

  async search(query, { category = null, limit = 50 } = {}) {
    if (!query) return [];
    const q = String(query).toLowerCase();
    const { headers, rows } = await this.fetchRaw();
    const results = [];
    for (const row of rows) {
      const anyMatch = row.some(cell => {
        if (cell === null || cell === undefined) return false;
        return String(cell).toLowerCase().includes(q);
      });
      if (!anyMatch) continue;
      const mapped = this.mapRowToExpected(row, headers);
      const { category: mappedCategory, specs } = this.buildSpecsFromMapped(mapped);
      if (category && mappedCategory !== String(category).toLowerCase()) continue;
      results.push({ meta: { sku: mapped.sku || null, name: mapped.name || null, family: mapped.family || null, category: mappedCategory }, specs, raw: mapped });
      if (results.length >= limit) break;
    }
    return results;
  }

  // helper: static parser para transformar variables de entorno a JSON credentials
  static parseCredentials(raw) {
    if (!raw) throw new Error('empty credentials');
    // 1) intento parse JSON directo
    try {
      if (typeof raw === 'object') return raw;
      return JSON.parse(raw);
    } catch (e) {
      // 2) intento base64
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        return JSON.parse(decoded);
      } catch (e2) {
        // 3) intentar reemplazar \n a saltos de línea y parsear
        try {
          const replaced = raw.replace(/\\n/g, '\n');
          return JSON.parse(replaced);
        } catch (e3) {
          throw new Error('Could not parse GOOGLE_CREDENTIALS: not valid JSON or base64');
        }
      }
    }
  }
}

module.exports = GoogleSheetsService;
