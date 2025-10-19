# Crear el detectionService.js corregido

detection_service_content = """// detectionService.js
// Sistema de detección de filtros con búsqueda en Google Sheets y clasificación HD/LD

// Variable para almacenar la instancia de Google Sheets
let sheetsInstance = null;

// Función para establecer la instancia de Google Sheets
function setSheetsInstance(instance) {
    sheetsInstance = instance;
    console.log('✅ Instancia de Google Sheets configurada en detectionService');
}

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
        if (!sheetsInstance) {
            throw new Error('Google Sheets no está inicializado');
        }

        console.log(`🔍 Buscando en Google Sheets: ${query}`);
        
        const queryNorm = query.toUpperCase().trim();
        const result = await sheetsInstance.searchInMaster(queryNorm);
        
        if (result && result.found) {
            console.log(`✅ Encontrado en Google Sheets: ${result.data.sku}`);
            return {
                found: true,
                source: 'google_sheets',
                data: result.data,
                confidence: 1.0
            };
        }
        
        console.log(`❌ No encontrado en Google Sheets`);
        return {
            found: false,
            source: 'google_sheets',
            data: null
        };
    } catch (error) {
        console.error('Error buscando en Google Sheets:', error);
        return {
            found: false,
            source: 'google_sheets',
            error: error.message
        };
    }
}

// ============================================================================
// CLASIFICACIÓN HD/LD
// ============================================================================

function classifyDutyLevel(context) {
    const contextUpper = context.toUpperCase();
    
    let hdScore = 0;
    let ldScore = 0;
    
    // Verificar fabricantes
    for (const mfg of HD_MANUFACTURERS) {
        if (contextUpper.includes(mfg)) {
            hdScore += 3;
        }
    }
    
    for (const mfg of LD_MANUFACTURERS) {
        if (contextUpper.includes(mfg)) {
            ldScore += 3;
        }
    }
    
    // Verificar keywords
    for (const keyword of HD_KEYWORDS) {
        if (contextUpper.includes(keyword)) {
            hdScore += 2;
        }
    }
    
    for (const keyword of LD_KEYWORDS) {
        if (contextUpper.includes(keyword)) {
            ldScore += 2;
        }
    }
    
    // Determinar clasificación
    if (hdScore > ldScore) {
        return {
            dutyLevel: 'HD',
            confidence: hdScore / (hdScore + ldScore),
            hdScore: hdScore,
            ldScore: ldScore
        };
    } else if (ldScore > hdScore) {
        return {
            dutyLevel: 'LD',
            confidence: ldScore / (hdScore + ldScore),
            hdScore: hdScore,
            ldScore: ldScore
        };
    } else {
        return {
            dutyLevel: 'UNKNOWN',
            confidence: 0,
            hdScore: hdScore,
            ldScore: ldScore
        };
    }
}

// ============================================================================
// DETECCIÓN DE FAMILIA DE FILTRO
// ============================================================================

function detectFilterFamily(query, context = '') {
    const combined = (query + ' ' + context).toUpperCase();
    
    // Patrones para cada familia
    const patterns = {
        'OIL': ['OIL', 'ACEITE', 'LUBRICANT', 'LUBRICATION', 'LF', 'P550'],
        'FUEL': ['FUEL', 'COMBUSTIBLE', 'DIESEL', 'GASOLINE', 'FF', 'FS', 'P550'],
        'AIR': ['AIR', 'AIRE', 'AF', 'PA', 'INTAKE', 'ADMISION'],
        'HYDRAULIC': ['HYDRAULIC', 'HIDRAULICO', 'HF', 'HH', 'TRANSMISSION', 'TRANSMISION'],
        'COOLANT': ['COOLANT', 'REFRIGERANTE', 'WF', 'WATER', 'AGUA'],
        'CABIN': ['CABIN', 'CABINA', 'CF', 'HVAC', 'AC'],
        'SEPARATOR': ['SEPARATOR', 'SEPARADOR', 'COALESCER', 'COALESCENTE']
    };
    
    const scores = {};
    
    for (const [family, keywords] of Object.entries(patterns)) {
        scores[family] = 0;
        for (const keyword of keywords) {
            if (combined.includes(keyword)) {
                scores[family]++;
            }
        }
    }
    
    // Encontrar la familia con mayor score
    let maxScore = 0;
    let detectedFamily = 'UNKNOWN';
    
    for (const [family, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            detectedFamily = family;
        }
    }
    
    return {
        family: detectedFamily,
        confidence: maxScore > 0 ? Math.min(maxScore / 3, 1.0) : 0,
        scores: scores
    };
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE DETECCIÓN
// ============================================================================

async function detectFilter(query) {
    try {
        console.log(`\\n${'='.repeat(60)}`);
        console.log(`🔍 INICIANDO DETECCIÓN DE FILTRO`);
        console.log(`Query: ${query}`);
        console.log('='.repeat(60));
        
        // PASO 1: Buscar en Google Sheets
        console.log('\\n📊 PASO 1: Búsqueda en Google Sheets');
        const sheetsResult = await searchInGoogleSheets(query);
        
        if (sheetsResult.found) {
            console.log('✅ Filtro encontrado en base de datos');
            
            return {
                success: true,
                source: 'database',
                query: query,
                filter: {
                    sku: sheetsResult.data.sku,
                    family: sheetsResult.data.family || 'UNKNOWN',
                    dutyLevel: sheetsResult.data.duty_level || 'UNKNOWN',
                    specs: sheetsResult.data.specs || {},
                    oemCodes: sheetsResult.data.oem_codes || [],
                    crossReference: sheetsResult.data.cross_reference || [],
                    rawData: sheetsResult.data
                },
                confidence: sheetsResult.confidence,
                timestamp: new Date().toISOString()
            };
        }
        
        // PASO 2: Si no se encuentra, intentar detección por patrones
        console.log('\\n🔍 PASO 2: Detección por patrones');
        console.log('⚠️ No encontrado en base de datos, analizando patrones...');
        
        const familyDetection = detectFilterFamily(query);
        console.log(`Familia detectada: ${familyDetection.family} (confianza: ${(familyDetection.confidence * 100).toFixed(1)}%)`);
        
        const dutyClassification = classifyDutyLevel(query);
        console.log(`Duty Level: ${dutyClassification.dutyLevel} (confianza: ${(dutyClassification.confidence * 100).toFixed(1)}%)`);
        
        return {
            success: true,
            source: 'pattern_detection',
            query: query,
            filter: {
                sku: null,
                family: familyDetection.family,
                dutyLevel: dutyClassification.dutyLevel,
                specs: {},
                oemCodes: [],
                crossReference: [],
                rawData: null
            },
            confidence: (familyDetection.confidence + dutyClassification.confidence) / 2,
            detection: {
                family: familyDetection,
                dutyLevel: dutyClassification
            },
            warning: 'Filtro no encontrado en base de datos. Resultados basados en detección de patrones.',
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('❌ Error en detección de filtro:', error);
        return {
            success: false,
            error: error.message,
            query: query,
            timestamp: new Date().toISOString()
        };
    }
}

// ============================================================================
// EXPORTAR FUNCIONES
// ============================================================================

module.exports = {
    detectFilter,
    searchInGoogleSheets,
    classifyDutyLevel,
    detectFilterFamily,
    setSheetsInstance
};
"""

with open('detectionService_FIXED.js', 'w', encoding='utf-8') as f:
    f.write(detection_service_content)

print("✅ detectionService.js corregido creado")
print("\nCambios principales:")
print("1. ✅ Variable sheetsInstance para almacenar la instancia")
print("2. ✅ Función setSheetsInstance() para recibir la instancia desde server.js")
print("3. ✅ Validación de instancia antes de usar")
print("4. ✅ Logs mejorados para debugging")
print("5. ✅ Exporta setSheetsInstance")
