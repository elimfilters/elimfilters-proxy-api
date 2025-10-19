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
    'LIEBHERR', 'TEREX', 'SCANIA', 'MAN', 'DAF', 'MERCEDES ACTROS'
];

const LD_MANUFACTURERS = [
    'TOYOTA', 'FORD', 'MERCEDES BENZ', 'BMW', 'HONDA', 'NISSAN',
    'CHEVROLET', 'MAZDA', 'HYUNDAI', 'KIA', 'VOLKSWAGEN', 'AUDI',
    'SUBARU', 'MITSUBISHI', 'JEEP', 'DODGE', 'RAM', 'GMC',
    'LEXUS', 'INFINITI', 'ACURA', 'BUICK', 'CADILLAC'
];

const HD_KEYWORDS = [
    'DIESEL', 'HEAVY DUTY', 'TRUCK', 'CAMION', 'MAQUINARIA PESADA',
    'EXCAVATOR', 'EXCAVADORA', 'BULLDOZER', 'LOADER', 'CARGADOR',
    'GRADER', 'MOTONIVELADORA', 'TRACTOR', 'AGRICULTURAL', 'AGRICOLA',
    'STATIONARY ENGINE', 'MOTOR ESTACIONARIO', 'GENERATOR', 'GENERADOR',
    'COMPRESSOR', 'COMPRESOR', 'MINING', 'MINERIA', 'CONSTRUCTION',
    'CONSTRUCCION', 'FORESTRY', 'FORESTAL', 'MARINE', 'MARINO'
];

const LD_KEYWORDS = [
    'GASOLINE', 'GASOLINA', 'PETROL', 'AUTOMOBILE', 'AUTOMOVIL',
    'CAR', 'CARRO', 'SUV', 'SEDAN', 'PICKUP LIGERA', 'LIGHT PICKUP',
    'VAN', 'MINIVAN', 'CROSSOVER', 'HATCHBACK', 'COUPE', 'PASSENGER'
];

// ============================================================================
// FUNCIONES DE BÚSQUEDA EN GOOGLE SHEETS
// ============================================================================

async function searchInGoogleSheets(query) {
    try {
        // Obtener todos los datos de la hoja
        const allData = await googleSheetsConnector.readData();
        
        if (!allData || allData.length === 0) {
            return null;
        }
        
        // Normalizar query
        const normalizedQuery = query.toUpperCase().trim();
        
        // Buscar en las columnas técnicas
        const result = allData.find(row => {
            // Buscar en OEM Codes
            if (row.oemCodes && row.oemCodes.toUpperCase().includes(normalizedQuery)) {
                return true;
            }
            
            // Buscar en Cross Reference
            if (row.crossReference && row.crossReference.toUpperCase().includes(normalizedQuery)) {
                return true;
            }
            
            // Buscar en SKU
            if (row.sku && row.sku.toUpperCase() === normalizedQuery) {
                return true;
            }
            
            return false;
        });
        
        return result || null;
        
    } catch (error) {
        console.error('Error buscando en Google Sheets:', error);
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
        filterType = ''
    } = filterData;
    
    // Combinar todos los textos para análisis
    const combinedText = `${oemCodes} ${engineApplications} ${equipmentApplications} ${filterType}`.toUpperCase();
    
    let hdScore = 0;
    let ldScore = 0;
    
    // CRITERIO 1: Fabricante OEM
    for (const manufacturer of HD_MANUFACTURERS) {
        if (combinedText.includes(manufacturer)) {
            hdScore += 3; // Peso alto para fabricante
            break;
        }
    }
    
    for (const manufacturer of LD_MANUFACTURERS) {
        if (combinedText.includes(manufacturer)) {
            ldScore += 3;
            break;
        }
    }
    
    // CRITERIO 2: Palabras clave de aplicación
    for (const keyword of HD_KEYWORDS) {
        if (combinedText.includes(keyword)) {
            hdScore += 1;
        }
    }
    
    for (const keyword of LD_KEYWORDS) {
        if (combinedText.includes(keyword)) {
            ldScore += 1;
        }
    }
    
    // Determinar clasificación
    if (hdScore > ldScore) {
        return 'HD';
    } else if (ldScore > hdScore) {
        return 'LD';
    } else {
        // Si hay empate, usar criterio por defecto basado en fabricante
        if (hdScore > 0) return 'HD';
        if (ldScore > 0) return 'LD';
        
        // Si no hay información suficiente, retornar null
        return null;
    }
}

// ============================================================================
// DETECCIÓN DE FAMILIA DE FILTRO
// ============================================================================

function detectFilterFamily(filterData) {
    const { filterType = '', engineApplications = '', equipmentApplications = '' } = filterData;
    const combinedText = `${filterType} ${engineApplications} ${equipmentApplications}`.toUpperCase();
    
    // Mapeo de palabras clave a familias
    const familyKeywords = {
        'ACEITE': ['OIL', 'ACEITE', 'LUBRICANT', 'LUBRICATION', 'ENGINE OIL'],
        'COMBUSTIBLE': ['FUEL', 'COMBUSTIBLE', 'DIESEL FUEL', 'GASOLINE', 'GASOLINA'],
        'AIRE': ['AIR', 'AIRE', 'AIR FILTER', 'AIR INTAKE', 'ENGINE AIR'],
        'AIRE_CABINA': ['CABIN', 'CABINA', 'CABIN AIR', 'HVAC', 'A/C FILTER'],
        'HIDRAULICO': ['HYDRAULIC', 'HIDRAULICO', 'TRANSMISSION', 'TRANSMISION'],
        'AIR_DRYER': ['AIR DRYER', 'SECADOR', 'AIR BRAKE'],
        'SEPARADOR': ['SEPARATOR', 'SEPARADOR', 'FUEL WATER SEPARATOR'],
        'REFRIGERANTE': ['COOLANT', 'REFRIGERANTE', 'COOLING', 'RADIATOR'],
        'CARCASA': ['HOUSING', 'CARCASA', 'CANISTER'],
        'KIT': ['KIT', 'SERVICE KIT', 'MAINTENANCE KIT']
    };
    
    for (const [family, keywords] of Object.entries(familyKeywords)) {
        for (const keyword of keywords) {
            if (combinedText.includes(keyword)) {
                return family;
            }
        }
    }
    
    return null;
}

// ============================================================================
// BÚSQUEDA WEB (FALLBACK)
// ============================================================================

async function searchWeb(query) {
    // Esta función se implementaría con una API de búsqueda web
    // Por ahora retornamos null para indicar que no se encontró
    console.log(`Búsqueda web para: ${query} - No implementada aún`);
    return null;
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE DETECCIÓN
// ============================================================================

async function detectFilter(query) {
    try {
        // PASO 1: Buscar en Google Sheets
        console.log(`Buscando "${query}" en Google Sheets...`);
        let filterData = await searchInGoogleSheets(query);
        
        if (filterData) {
            console.log('✅ Filtro encontrado en Google Sheets');
            
            // Si ya tiene duty_level definido, usarlo
            if (filterData.duty_level && filterData.duty_level.trim() !== '') {
                return {
                    found: true,
                    source: 'google_sheets',
                    data: filterData,
                    dutyLevel: filterData.duty_level,
                    family: filterData.family || detectFilterFamily(filterData)
                };
            }
            
            // Si no tiene duty_level, clasificarlo
            const dutyLevel = classifyDutyLevel(filterData);
            const family = filterData.family || detectFilterFamily(filterData);
            
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
        console.log('❌ No encontrado en Google Sheets. Buscando en web...');
        filterData = await searchWeb(query);
        
        if (filterData) {
            console.log('✅ Filtro encontrado en web');
            
            const dutyLevel = classifyDutyLevel(filterData);
            const family = detectFilterFamily(filterData);
            
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
        console.log('❌ Filtro no encontrado');
        return {
            found: false,
            source: null,
            data: null,
            dutyLevel: null,
            family: null,
            error: 'Filtro no encontrado en base de datos ni en búsqueda web'
        };
        
    } catch (error) {
        console.error('Error en detección de filtro:', error);
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
