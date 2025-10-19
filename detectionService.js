// detectionService.js
// Sistema de detección de filtros con búsqueda en Google Sheets y clasificación HD/LD

const googleSheetsConnector = require('./googleSheetsConnector');

// ============================================================================
// CLASIFICADORES HD/LD
// ============================================================================

const HD_MANUFACTURERS = [
    'CATERPILLAR', 'CAT', 'KOMATSU', 'VOLVO', 'MACK', 'ISUZU', 'IVECO',
    'CUMMINS', 'DETROIT', 'PACCAR', 'NAVISTAR', 'FREIGHTLINER', 'INTERNATIONAL',
    'JOHN DEERE', 'CASE', 'NEW HOLLAND', 'HITACHI', 'DOOSAN', 'HYUNDAI HEAVY',
    'LIEBHERR', 'TEREX', 'SCANIA', 'MAN', 'DAF', 'MERCEDES ACTROS', 'DONALDSON'
];

const LD_MANUFACTURERS = [
    'TOYOTA', 'FORD', 'MERCEDES BENZ', 'BMW', 'HONDA', 'NISSAN',
    'CHEVROLET', 'MAZDA', 'HYUNDAI', 'KIA', 'VOLKSWAGEN', 'AUDI',
    'SUBARU', 'MITSUBISHI', 'JEEP', 'DODGE', 'RAM', 'GMC',
    'LEXUS', 'INFINITI', 'ACURA', 'BUICK', 'CADILLAC', 'FRAM', 'WIX'
];

const HD_KEYWORDS = [
    'DIESEL', 'HEAVY DUTY', 'TRUCK', 'CAMION', 'MAQUINARIA PESADA',
    'EXCAVATOR', 'EXCAVADORA', 'BULLDOZER', 'LOADER', 'CARGADOR',
    'GRADER', 'MOTONIVELADORA', 'TRACTOR', 'AGRICULTURAL', 'AGRICOLA',
    'STATIONARY ENGINE', 'MOTOR ESTACIONARIO', 'GENERATOR', 'GENERADOR',
    'COMPRESSOR', 'COMPRESOR', 'MINING', 'MINERIA', 'CONSTRUCTION',
    'CONSTRUCCION', 'FORESTRY', 'FORESTAL', 'MARINE', 'MARINO',
    'OFF-HIGHWAY', 'OFF HIGHWAY', 'INDUSTRIAL'
];

const LD_KEYWORDS = [
    'GASOLINE', 'GASOLINA', 'PETROL', 'AUTOMOBILE', 'AUTOMOVIL',
    'CAR', 'CARRO', 'SUV', 'SEDAN', 'PICKUP LIGERA', 'LIGHT PICKUP',
    'VAN', 'MINIVAN', 'CROSSOVER', 'HATCHBACK', 'COUPE', 'PASSENGER',
    'LIGHT DUTY', 'ON-HIGHWAY', 'ON HIGHWAY'
];

// ============================================================================
// FUNCIONES DE BÚSQUEDA EN GOOGLE SHEETS
// ============================================================================

async function searchInGoogleSheets(query) {
    try {
        // Obtener todos los datos de la hoja
        const allData = await googleSheetsConnector.readData();
        
        if (!allData || allData.length === 0) {
            console.log('⚠️ Google Sheets vacío o sin datos');
            return null;
        }
        
        // Normalizar query
        const normalizedQuery = query.toUpperCase().trim();
        console.log(`🔍 Buscando: "${normalizedQuery}" en ${allData.length} registros`);
        
        // Buscar en las columnas técnicas
        const result = allData.find(row => {
            // Buscar en SKU (exacto)
            if (row.sku && row.sku.toUpperCase() === normalizedQuery) {
                console.log(`✅ Encontrado en SKU: ${row.sku}`);
                return true;
            }
            
            // Buscar en OEM Codes (contiene)
            if (row.oemCodes) {
                const oemArray = row.oemCodes.split(',').map(code => code.trim().toUpperCase());
                if (oemArray.some(code => code === normalizedQuery || code.includes(normalizedQuery))) {
                    console.log(`✅ Encontrado en OEM Codes: ${row.oemCodes}`);
                    return true;
                }
            }
            
            // Buscar en Cross Reference (contiene)
            if (row.crossReference) {
                const crossArray = row.crossReference.split(',').map(code => code.trim().toUpperCase());
                if (crossArray.some(code => code === normalizedQuery || code.includes(normalizedQuery))) {
                    console.log(`✅ Encontrado en Cross Reference: ${row.crossReference}`);
                    return true;
                }
            }
            
            return false;
        });
        
        if (!result) {
            console.log('❌ No encontrado en Google Sheets');
        }
        
        return result || null;
        
    } catch (error) {
        console.error('❌ Error buscando en Google Sheets:', error);
        return null;
    }
}

// ============================================================================
// CLASIFICACIÓN HD/LD
// ============================================================================

function classifyDutyLevel(filterData) {
    const {
        oemCodes = '',
        engineApplications = '',
        equipmentApplications = '',
        filterType = '',
        crossReference = ''
    } = filterData;
    
    // Combinar todos los textos para análisis
    const combinedText = `${oemCodes} ${engineApplications} ${equipmentApplications} ${filterType} ${crossReference}`.toUpperCase();
    
    let hdScore = 0;
    let ldScore = 0;
    
    console.log(`📊 Clasificando Duty Level...`);
    
    // CRITERIO 1: Fabricante OEM (peso alto)
    for (const manufacturer of HD_MANUFACTURERS) {
        if (combinedText.includes(manufacturer)) {
            hdScore += 3;
            console.log(`  ✓ HD Manufacturer detectado: ${manufacturer} (+3)`);
            break;
        }
    }
    
    for (const manufacturer of LD_MANUFACTURERS) {
        if (combinedText.includes(manufacturer)) {
            ldScore += 3;
            console.log(`  ✓ LD Manufacturer detectado: ${manufacturer} (+3)`);
            break;
        }
    }
    
    // CRITERIO 2: Palabras clave de aplicación
    for (const keyword of HD_KEYWORDS) {
        if (combinedText.includes(keyword)) {
            hdScore += 1;
            console.log(`  ✓ HD Keyword: ${keyword} (+1)`);
        }
    }
    
    for (const keyword of LD_KEYWORDS) {
        if (combinedText.includes(keyword)) {
            ldScore += 1;
            console.log(`  ✓ LD Keyword: ${keyword} (+1)`);
        }
    }
    
    console.log(`  📈 Scores - HD: ${hdScore}, LD: ${ldScore}`);
    
    // Determinar clasificación
    if (hdScore > ldScore) {
        console.log(`  ✅ Clasificado como: HD`);
        return 'HD';
    } else if (ldScore > hdScore) {
        console.log(`  ✅ Clasificado como: LD`);
        return 'LD';
    } else {
        // Si hay empate, usar criterio por defecto
        if (hdScore > 0) {
            console.log(`  ⚖️ Empate - Default: HD`);
            return 'HD';
        }
        if (ldScore > 0) {
            console.log(`  ⚖️ Empate - Default: LD`);
            return 'LD';
        }
        
        console.log(`  ⚠️ Sin información suficiente para clasificar`);
        return null;
    }
}

// ============================================================================
// DETECCIÓN DE FAMILIA DE FILTRO
// ============================================================================

function detectFilterFamily(filterData) {
    const { 
        filterType = '', 
        engineApplications = '', 
        equipmentApplications = '',
        sku = ''
    } = filterData;
    
    const combinedText = `${filterType} ${engineApplications} ${equipmentApplications}`.toUpperCase();
    
    console.log(`🔍 Detectando familia de filtro...`);
    
    // Mapeo de palabras clave a familias (orden de prioridad)
    const familyKeywords = {
        'SEPARADOR': ['FUEL WATER SEPARATOR', 'SEPARATOR', 'SEPARADOR'],
        'AIR_DRYER': ['AIR DRYER', 'SECADOR DE AIRE', 'AIR BRAKE DRYER'],
        'AIRE_CABINA': ['CABIN AIR', 'CABINA', 'HVAC', 'A/C FILTER', 'CABIN FILTER'],
        'REFRIGERANTE': ['COOLANT', 'REFRIGERANTE', 'COOLING SYSTEM', 'RADIATOR'],
        'HIDRAULICO': ['HYDRAULIC', 'HIDRAULICO', 'TRANSMISSION', 'TRANSMISION', 'HYDRAULIC OIL'],
        'COMBUSTIBLE': ['FUEL', 'COMBUSTIBLE', 'DIESEL FUEL', 'GASOLINE FILTER', 'GASOLINA'],
        'ACEITE': ['OIL FILTER', 'ACEITE', 'LUBRICANT', 'LUBRICATION', 'ENGINE OIL', 'LUBE'],
        'AIRE': ['AIR FILTER', 'AIRE', 'AIR INTAKE', 'ENGINE AIR', 'PRIMARY AIR', 'SECONDARY AIR'],
        'CARCASA': ['HOUSING', 'CARCASA', 'CANISTER', 'BASE'],
        'KIT': ['KIT', 'SERVICE KIT', 'MAINTENANCE KIT', 'FILTER KIT']
    };
    
    // Buscar por palabras clave (orden de prioridad)
    for (const [family, keywords] of Object.entries(familyKeywords)) {
        for (const keyword of keywords) {
            if (combinedText.includes(keyword)) {
                console.log(`  ✅ Familia detectada: ${family} (keyword: ${keyword})`);
                return family;
            }
        }
    }
    
    // Si no se detectó, intentar por prefijo de SKU
    if (sku) {
        const skuUpper = sku.toUpperCase();
        if (skuUpper.startsWith('EL8')) return 'ACEITE';
        if (skuUpper.startsWith('EF9')) return 'COMBUSTIBLE';
        if (skuUpper.startsWith('EA1')) return 'AIRE';
        if (skuUpper.startsWith('EC1')) return 'AIRE_CABINA';
        if (skuUpper.startsWith('EH6')) return 'HIDRAULICO';
        if (skuUpper.startsWith('ED4')) return 'AIR_DRYER';
        if (skuUpper.startsWith('EW7')) return 'REFRIGERANTE';
        if (skuUpper.startsWith('EB1')) return 'CARCASA';
        if (skuUpper.startsWith('EK')) return 'KIT';
    }
    
    console.log(`  ⚠️ No se pudo detectar la familia`);
    return null;
}

// ============================================================================
// BÚSQUEDA WEB (FALLBACK)
// ============================================================================

async function searchWeb(query) {
    // Esta función se implementaría con una API de búsqueda web
    // Por ahora retornamos null para indicar que no se encontró
    console.log(`🌐 Búsqueda web para: ${query} - No implementada aún`);
    return null;
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE DETECCIÓN
// ============================================================================

async function detectFilter(query) {
    try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔍 INICIANDO DETECCIÓN DE FILTRO: "${query}"`);
        console.log(`${'='.repeat(60)}\n`);
        
        // PASO 1: Buscar en Google Sheets
        console.log(`📋 PASO 1: Buscando en Google Sheets...`);
        let filterData = await searchInGoogleSheets(query);
        
        if (filterData) {
            console.log('✅ Filtro encontrado en Google Sheets\n');
            
            // Si ya tiene duty_level definido, usarlo
            if (filterData.duty_level && filterData.duty_level.trim() !== '') {
                console.log(`✅ Duty Level ya definido: ${filterData.duty_level}`);
                return {
                    found: true,
                    source: 'google_sheets',
                    data: filterData,
                    dutyLevel: filterData.duty_level,
                    family: filterData.family || detectFilterFamily(filterData),
                    classified: false
                };
            }
            
            // Si no tiene duty_level, clasificarlo
            console.log(`⚙️ Clasificando Duty Level...`);
            const dutyLevel = classifyDutyLevel(filterData);
            const family = filterData.family || detectFilterFamily(filterData);
            
            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ DETECCIÓN COMPLETADA`);
            console.log(`   Familia: ${family || 'No detectada'}`);
            console.log(`   Duty Level: ${dutyLevel || 'No clasificado'}`);
            console.log(`${'='.repeat(60)}\n`);
            
            return {
                found: true,
                source: 'google_sheets',
                data: filterData,
                dutyLevel: dutyLevel,
                family: family,
                classified: true
            };
        }
        
        // PASO 2: Si no se encuentra, buscar en web
        console.log('\n📋 PASO 2: Buscando en Web...');
        filterData = await searchWeb(query);
        
        if (filterData) {
            console.log('✅ Filtro encontrado en web\n');
            
            const dutyLevel = classifyDutyLevel(filterData);
            const family = detectFilterFamily(filterData);
            
            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ DETECCIÓN COMPLETADA (Web)`);
            console.log(`   Familia: ${family || 'No detectada'}`);
            console.log(`   Duty Level: ${dutyLevel || 'No clasificado'}`);
            console.log(`${'='.repeat(60)}\n`);
            
            return {
                found: true,
                source: 'Web Search',
                data: filterData,
                dutyLevel: dutyLevel,
                family: family,
                classified: true
            };
        }
        
        // PASO 3: No se encontró en ningún lado
        console.log('\n❌ FILTRO NO ENCONTRADO\n');
        return {
            found: false,
            source: null,
            data: null,
            dutyLevel: null,
            family: null,
            error: 'Filtro no encontrado en base de datos ni en búsqueda web'
        };
        
    } catch (error) {
        console.error('\n❌ ERROR EN DETECCIÓN:', error);
        return {
            found: false,
            source: null,
            data: null,
            dutyLevel: null,
            family: null,
            error: error.message
        };
    }
}

// ============================================================================
// EXPORTACIONES
// ============================================================================

module.exports = {
    detectFilter,
    searchInGoogleSheets,
    classifyDutyLevel,
    detectFilterFamily,
    searchWeb
};
