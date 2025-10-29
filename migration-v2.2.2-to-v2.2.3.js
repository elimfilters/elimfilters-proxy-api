// migration-v2.2.2-to-v2.2.3.js
// Script de migración para corregir SKUs con las reglas actualizadas

require('dotenv').config();
const { google } = require('googleapis');

// ============================================================================
// MAPEO DE CORRECCIONES
// ============================================================================

const PREFIX_MIGRATIONS = {
  'EL9': 'EL8',  // OIL|LD
  'EF8': 'EF9',  // FUEL|HD
  'EA2': 'EA1',  // AIRE|LD (nota: EA2 ahora es CARCAZA AIR FILTER|HD)
  'EC2': 'EC1',  // CABIN|HD
  'ED1': 'ED4',  // AIR DRYER|HD
  'ET8': 'EW7',  // COOLANT|HD
  'EZ1': 'EA2',  // CARCAZA AIR FILTER|HD (cambio de letra y número)
  'EB1': 'ET9',  // TURBINE SERIES|HD
  'EK8': 'EK5',  // KITS SERIES HD|HD
  'EK9': 'EK3'   // KITS SERIES LD|LD
};

// Combinaciones que ya no existen (se deben eliminar o revisar manualmente)
const DELETED_COMBINATIONS = [
  'FUEL SEPARATOR|LD',
  'AIR DRYER|LD',
  'COOLANT|LD',
  'CARCAZA AIR FILTER|LD',
  'TURBINE SERIES|LD'
];

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const SHEET_ID = process.env.GOOGLE_SHEETS_ID || '1ZYI5c0enkuvWAveu8HMaCUk1cek_VDrX8GtgKW7VP6U';

// ============================================================================
// FUNCIONES DE GOOGLE SHEETS
// ============================================================================

async function getGoogleSheetsClient() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('❌ Error creating Google Sheets client:', error.message);
    throw error;
  }
}

async function getAllFilters(sheets) {
  console.log('📊 Leyendo todos los filtros del Sheet...');
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'FILTERS!A2:AF'
  });
  
  const rows = response.data.values || [];
  console.log(`   Encontrados: ${rows.length} filtros`);
  
  return rows.map((row, index) => ({
    rowNumber: index + 2, // +2 porque row 1 son headers y empezamos en 2
    sku: row[0] || '',
    oem_code: row[1] || '',
    family: row[2] || '',
    duty: row[3] || '',
    specs_summary: row[4] || '',
    cross_reference: row[5] || '',
    fullRow: row
  }));
}

// ============================================================================
// FUNCIONES DE ANÁLISIS
// ============================================================================

function analyzeFilter(filter) {
  const { sku, family, duty } = filter;
  
  if (!sku || sku.length < 5) {
    return { needsMigration: false, reason: 'No SKU or too short' };
  }
  
  const prefix = sku.substring(0, 3);
  const last4 = sku.substring(3);
  
  // Verificar si el prefix necesita migración
  const newPrefix = PREFIX_MIGRATIONS[prefix];
  if (newPrefix) {
    return {
      needsMigration: true,
      type: 'prefix_change',
      oldPrefix: prefix,
      newPrefix: newPrefix,
      oldSKU: sku,
      newSKU: `${newPrefix}${last4}`,
      family: family,
      duty: duty
    };
  }
  
  // Verificar si es una combinación eliminada
  const combination = `${family}|${duty}`;
  if (DELETED_COMBINATIONS.includes(combination)) {
    return {
      needsMigration: true,
      type: 'deleted_combination',
      combination: combination,
      reason: 'Esta combinación ya no existe en las reglas',
      action: 'MANUAL_REVIEW_REQUIRED'
    };
  }
  
  // Caso especial: AIRE|LD con EA2 debe cambiar a EA1
  if (family === 'AIRE' && duty === 'LD' && prefix === 'EA2') {
    return {
      needsMigration: true,
      type: 'special_case_AIRE_LD',
      oldPrefix: 'EA2',
      newPrefix: 'EA1',
      oldSKU: sku,
      newSKU: `EA1${last4}`,
      note: 'AIRE|LD ahora usa EA1'
    };
  }
  
  return { needsMigration: false, reason: 'SKU is correct' };
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE MIGRACIÓN
// ============================================================================

async function migrate(dryRun = true) {
  console.log('\n' + '='.repeat(70));
  console.log('🔄 MIGRACIÓN v2.2.2 → v2.2.3');
  console.log('   Corrección de SKUs según reglas actualizadas');
  console.log('='.repeat(70));
  console.log(`\n📋 Modo: ${dryRun ? 'DRY RUN (simulación)' : 'REAL (aplicará cambios)'}\n`);
  
  const sheets = await getGoogleSheetsClient();
  const filters = await getAllFilters(sheets);
  
  console.log('\n🔍 Analizando filtros...\n');
  
  const migrations = [];
  const deletedCombinations = [];
  const correct = [];
  
  filters.forEach(filter => {
    const analysis = analyzeFilter(filter);
    
    if (analysis.needsMigration) {
      if (analysis.type === 'deleted_combination') {
        deletedCombinations.push({ filter, analysis });
      } else {
        migrations.push({ filter, analysis });
      }
    } else {
      correct.push(filter);
    }
  });
  
  // ============================================================================
  // REPORTE
  // ============================================================================
  
  console.log('📊 RESUMEN DEL ANÁLISIS:\n');
  console.log(`   ✅ Correctos:                  ${correct.length}`);
  console.log(`   🔄 Requieren migración:        ${migrations.length}`);
  console.log(`   ⚠️  Combinaciones eliminadas:  ${deletedCombinations.length}`);
  console.log(`   📝 Total analizado:            ${filters.length}\n`);
  
  // ============================================================================
  // MIGRACIONES POR PREFIX
  // ============================================================================
  
  if (migrations.length > 0) {
    console.log('🔄 CAMBIOS DE PREFIX:\n');
    
    const byPrefix = {};
    migrations.forEach(({ analysis }) => {
      const key = `${analysis.oldPrefix} → ${analysis.newPrefix}`;
      if (!byPrefix[key]) byPrefix[key] = [];
      byPrefix[key].push(analysis);
    });
    
    Object.entries(byPrefix).forEach(([change, items]) => {
      console.log(`   ${change}: ${items.length} filtros`);
      items.slice(0, 3).forEach(item => {
        console.log(`      ${item.oldSKU} → ${item.newSKU} (${item.family}|${item.duty})`);
      });
      if (items.length > 3) {
        console.log(`      ... y ${items.length - 3} más`);
      }
      console.log('');
    });
  }
  
  // ============================================================================
  // COMBINACIONES ELIMINADAS
  // ============================================================================
  
  if (deletedCombinations.length > 0) {
    console.log('⚠️  COMBINACIONES QUE YA NO EXISTEN:\n');
    
    deletedCombinations.forEach(({ filter, analysis }) => {
      console.log(`   SKU: ${filter.sku}`);
      console.log(`   Combinación: ${analysis.combination}`);
      console.log(`   Razón: ${analysis.reason}`);
      console.log(`   Acción: Revisar manualmente\n`);
    });
  }
  
  // ============================================================================
  // APLICAR CAMBIOS (si no es dry run)
  // ============================================================================
  
  if (!dryRun && migrations.length > 0) {
    console.log('\n🚀 Aplicando cambios al Google Sheet...\n');
    
    const updates = migrations.map(({ filter, analysis }) => ({
      range: `FILTERS!A${filter.rowNumber}`,
      values: [[analysis.newSKU]]
    }));
    
    // Aplicar en batches de 100
    const batchSize = 100;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: batch
        }
      });
      
      console.log(`   ✅ Actualizados ${Math.min(i + batchSize, updates.length)}/${updates.length}`);
    }
    
    console.log('\n✅ Migración completada!');
  } else if (dryRun) {
    console.log('\n💡 Esta fue una simulación. Para aplicar los cambios:');
    console.log('   node migration-v2.2.2-to-v2.2.3.js --apply\n');
  }
  
  // ============================================================================
  // EXPORTAR REPORTE
  // ============================================================================
  
  const report = {
    date: new Date().toISOString(),
    dryRun: dryRun,
    summary: {
      total: filters.length,
      correct: correct.length,
      migrations: migrations.length,
      deletedCombinations: deletedCombinations.length
    },
    migrations: migrations.map(({ filter, analysis }) => ({
      rowNumber: filter.rowNumber,
      oem_code: filter.oem_code,
      family: filter.family,
      duty: filter.duty,
      oldSKU: analysis.oldSKU,
      newSKU: analysis.newSKU,
      oldPrefix: analysis.oldPrefix,
      newPrefix: analysis.newPrefix
    })),
    deletedCombinations: deletedCombinations.map(({ filter, analysis }) => ({
      rowNumber: filter.rowNumber,
      sku: filter.sku,
      oem_code: filter.oem_code,
      combination: analysis.combination,
      reason: analysis.reason
    }))
  };
  
  const fs = require('fs');
  const reportFile = `migration-report-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n📄 Reporte guardado: ${reportFile}\n`);
  
  return report;
}

// ============================================================================
// EJECUTAR
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply') || args.includes('-a');
  const dryRun = !apply;
  
  migrate(dryRun).catch(error => {
    console.error('\n❌ Error en migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { migrate, analyzeFilter, PREFIX_MIGRATIONS, DELETED_COMBINATIONS };
