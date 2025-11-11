// googleSheetsConnector.js v4.0.0 — CON GUARDADO COMPLETO
require('dotenv').config();
const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.sheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID || '';
    this.sheetName = process.env.SHEET_NAME || 'Master';
  }

  async initialize() {
    try {
      if (!process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
        throw new Error('Faltan variables de entorno de Google');
      }

      const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });

      console.log('✅ Google Sheets conectado correctamente');
    } catch (err) {
      console.error('❌ Error inicializando Google Sheets:', err.message);
      throw err;
    }
  }

  async readRange(sheetId, range) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
      });
      return response.data.values;
    } catch (error) {
      console.error('Error al leer rango:', error.message);
      return [];
    }
  }

  /**
   * Busca fila por query_norm - ACTUALIZADO con más campos
   */
  async findRowByQuery(query) {
    if (!this.sheets || !this.sheetId) return null;
    const range = `${this.sheetName}!A:Z`;
    
    try {
      const rows = await this.readRange(this.sheetId, range);
      if (!rows || rows.length === 0) return null;
      
      const headers = rows[0];
      const idxQueryNorm = headers.indexOf('query_norm');
      
      if (idxQueryNorm === -1) return null;
      
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r[idxQueryNorm] && r[idxQueryNorm].toString().toLowerCase() === query.toString().toLowerCase()) {
          // Mapear todos los campos
          const result = { found: true };
          headers.forEach((header, index) => {
            if (r[index] !== undefined && r[index] !== '') {
              result[header] = r[index];
            }
          });
          return result;
        }
      }
      return null;
    } catch (e) {
      console.warn('GoogleSheetsService.findRowByQuery fallo:', e.message);
      return null;
    }
  }

  /**
   * Busca cross-reference en tabla de equivalencias
   */
  async findCrossReference(partNumber) {
    if (!this.sheets || !this.sheetId) return null;
    const range = `${this.sheetName}!A:Z`;
    
    try {
      const rows = await this.readRange(this.sheetId, range);
      if (!rows || rows.length === 0) return null;
      
      const headers = rows[0];
      const idxOem = headers.indexOf('oem_cod');
      const idxDonaldson = headers.indexOf('donaldson_code');
      const idxFram = headers.indexOf('fram_code');
      const idxFamily = headers.indexOf('family');
      
      if (idxOem === -1) return null;
      
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r[idxOem] && r[idxOem].toString().toLowerCase() === partNumber.toString().toLowerCase()) {
          return {
            donaldson: idxDonaldson !== -1 ? r[idxDonaldson] : null,
            fram: idxFram !== -1 ? r[idxFram] : null,
            family: idxFamily !== -1 ? r[idxFamily] : null
          };
        }
      }
      return null;
    } catch (e) {
      console.warn('GoogleSheetsService.findCrossReference fallo:', e.message);
      return null;
    }
  }

  /**
   * Guarda o actualiza registro completo - ACTUALIZADO
   */
  async replaceOrInsertRow(data) {
    if (!this.sheets || !this.sheetId) {
      console.warn('⚠️ Sheets no inicializado, no se guardó');
      return;
    }
    
    try {
      console.log('💾 Guardando en Sheet Master:', data.query_norm);
      
      const range = `${this.sheetName}!A:Z`;
      const rows = await this.readRange(this.sheetId, range);
      
      if (!rows || rows.length === 0) {
        console.error('❌ Sheet vacío o sin headers');
        return;
      }
      
      const headers = rows[0];
      
      // Preparar fila completa con TODOS los campos
      const row = this.prepareCompleteRow(data, headers);
      
      // Buscar si ya existe
      const idxQueryNorm = headers.indexOf('query_norm');
      let rowIndex = -1;
      
      if (idxQueryNorm !== -1) {
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][idxQueryNorm] && rows[i][idxQueryNorm].toString().toLowerCase() === data.query_norm?.toString().toLowerCase()) {
            rowIndex = i + 1; // +1 porque Sheets es 1-indexed
            break;
          }
        }
      }
      
      if (rowIndex !== -1) {
        // Actualizar fila existente
        console.log(`📝 Actualizando fila ${rowIndex}`);
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: `${this.sheetName}!A${rowIndex}:Z${rowIndex}`,
          valueInputOption: 'RAW',
          resource: { values: [row] }
        });
      } else {
        // Insertar nueva fila
        console.log(`➕ Insertando nueva fila`);
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.sheetId,
          range: `${this.sheetName}!A:Z`,
          valueInputOption: 'RAW',
          resource: { values: [row] }
        });
      }
      
      console.log('✅ Guardado exitoso en Sheet Master');
      
    } catch (error) {
      console.error('❌ Error guardando en Sheet:', error.message);
    }
  }

  /**
   * Prepara fila completa mapeando todos los campos
   */
  prepareCompleteRow(data, headers) {
    const row = new Array(headers.length).fill('');
    
    // Mapear cada header a su valor
    headers.forEach((header, index) => {
      const value = this.getFieldValue(data, header);
      row[index] = value;
    });
    
    return row;
  }

  /**
   * Obtiene valor de un campo del objeto data
   */
  getFieldValue(data, fieldName) {
    // Campos simples
    if (data[fieldName] !== undefined && data[fieldName] !== null) {
      // Si es array, convertir a string separado por comas
      if (Array.isArray(data[fieldName])) {
        return data[fieldName].join(', ');
      }
      return String(data[fieldName]);
    }
    
    // Campos de specs
    if (fieldName in (data.specs || {})) {
      return String(data.specs[fieldName] || '');
    }
    
    // Mapeos especiales
    const mappings = {
      'donaldson_code': data.source_code && data.source === 'donaldson' ? data.source_code : '',
      'fram_code': data.source_code && data.source === 'fram' ? data.source_code : '',
      'oem_cod': data.oem_code || '',
      'rated_flow_gpm': data.specs?.rated_flow_gpm || '',
      'service_life_hours': data.specs?.service_life_hours || '',
      'change_interval_km': data.specs?.change_interval_km || '',
      'water_separation_efficiency_percent': data.specs?.water_separation_efficiency_percent || '',
      'drain_type': data.specs?.drain_type || '',
      'micron_rating': data.specs?.micron_rating || '',
      'collapse_pressure_psi': data.specs?.collapse_pressure_psi || ''
    };
    
    if (fieldName in mappings) {
      return mappings[fieldName];
    }
    
    return '';
  }

  /**
   * Crear headers si no existen (útil para inicialización)
   */
  async ensureHeaders() {
    if (!this.sheets || !this.sheetId) return;
    
    try {
      const range = `${this.sheetName}!A1:Z1`;
      const rows = await this.readRange(this.sheetId, range);
      
      if (!rows || rows.length === 0) {
        // Sheet vacío - crear headers
        const headers = [
          'query_norm',
          'sku',
          'description',
          'family',
          'duty',
          'oem_cod',
          'donaldson_code',
          'fram_code',
          'source',
          'cross_reference',
          'oem_codes',
          'engine_applications',
          'equipment_applications',
          'rated_flow_gpm',
          'service_life_hours',
          'change_interval_km',
          'water_separation_efficiency_percent',
          'drain_type',
          'micron_rating',
          'collapse_pressure_psi',
          'created_at'
        ];
        
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: range,
          valueInputOption: 'RAW',
          resource: { values: [headers] }
        });
        
        console.log('✅ Headers creados en Sheet Master');
      }
    } catch (error) {
      console.error('❌ Error creando headers:', error.message);
    }
  }
}

module.exports = GoogleSheetsService;
