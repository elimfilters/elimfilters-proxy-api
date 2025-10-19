# Crear detectionService.js COMPLETAMENTE NUEVO desde cero
# Sin leer el archivo original, escribiendo todo manualmente

detection_new = """// detectionService.js
// Filter detection system with Google Sheets search and classification

let sheetsInstance = null;

function setSheetsInstance(instance) {
    sheetsInstance = instance;
    console.log('Google Sheets instance configured in detectionService');
}

// HD Manufacturers
const HD_MANUFACTURERS = [
    'CATERPILLAR', 'CAT', 'KOMATSU', 'VOLVO', 'MACK', 'ISUZU', 'IVECO',
    'CUMMINS', 'DETROIT', 'PACCAR', 'NAVISTAR', 'FREIGHTLINER', 'INTERNATIONAL',
    'JOHN DEERE', 'CASE', 'NEW HOLLAND', 'HITACHI', 'DOOSAN', 'HYUNDAI HEAVY',
    'LIEBHERR', 'TEREX', 'SCANIA', 'MAN', 'DAF', 'MERCEDES ACTROS', 'DONALDSON'
];

// LD Manufacturers
const LD_MANUFACTURERS = [
    'TOYOTA', 'FORD', 'MERCEDES BENZ', 'BMW', 'HONDA', 'NISSAN',
    'CHEVROLET', 'MAZDA', 'HYUNDAI', 'KIA', 'VOLKSWAGEN', 'AUDI',
    'SUBARU', 'MITSUBISHI', 'JEEP', 'DODGE', 'RAM', 'GMC',
    'LEXUS', 'INFINITI', 'ACURA', 'BUICK', 'CADILLAC', 'FRAM', 'WIX'
];

// HD Keywords
const HD_KEYWORDS = [
    'DIESEL', 'HEAVY DUTY', 'TRUCK', 'CAMION', 'MAQUINARIA PESADA',
    'EXCAVATOR', 'EXCAVADORA', 'BULLDOZER', 'LOADER', 'CARGADOR',
    'GRADER', 'MOTONIVELADORA', 'TRACTOR', 'AGRICULTURAL', 'AGRICOLA',
    'STATIONARY ENGINE', 'MOTOR ESTACIONARIO', 'GENERATOR', 'GENERADOR',
    'COMPRESSOR', 'COMPRESOR', 'MINING', 'MINERIA', 'CONSTRUCTION',
    'CONSTRUCCION', 'FORESTRY', 'FORESTAL', 'MARINE', 'MARINO',
    'OFF-HIGHWAY', 'OFF HIGHWAY', 'INDUSTRIAL'
];

// LD Keywords
const LD_KEYWORDS = [
    'GASOLINE', 'GASOLINA', 'PETROL', 'AUTOMOBILE', 'AUTOMOVIL',
    'CAR', 'CARRO', 'SUV', 'SEDAN', 'PICKUP LIGERA', 'LIGHT PICKUP',
    'VAN', 'MINIVAN', 'CROSSOVER', 'HATCHBACK', 'COUPE', 'PASSENGER',
    'LIGHT DUTY', 'ON-HIGHWAY', 'ON HIGHWAY'
];

// Search in Google Sheets
async function searchInGoogleSheets(query) {
    try {
        if (!sheetsInstance) {
            console.error('Google Sheets instance not initialized');
            throw new Error('Google Sheets not initialized');
        }
        
        console.log('Searching in Google Sheets for:', query);
        const queryNorm = query.toUpperCase().trim();
        
        const result = await sheetsInstance.searchInMaster(queryNorm);
        
        if (result && result.found) {
            console.log('Found in Google Sheets - SKU:', result.data.sku);
            return {
                found: true,
                source: 'google_sheets',
                data: result.data,
                confidence: 1.0
            };
        }
        
        console.log('Not found in Google Sheets');
        return {
            found: false,
            source: 'google_sheets',
            data: null
        };
        
    } catch (error) {
        console.error('Error searching in Google Sheets:', error.message);
        return {
            found: false,
            source: 'google_sheets',
            error: error.message
        };
    }
}

// Classify duty level based on context
function classifyDutyLevel(context) {
    const contextUpper = context.toUpperCase();
    let hdScore = 0;
    let ldScore = 0;
    
    // Check manufacturers
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
    
    // Check keywords
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
    
    // Determine result
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

// Detect filter family
function detectFilterFamily(query, context) {
    context = context || '';
    const combined = (query + ' ' + context).toUpperCase();
    
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
    
    for (const family in patterns) {
        scores[family] = 0;
        const keywords = patterns[family];
        
        for (const keyword of keywords) {
            if (combined.includes(keyword)) {
                scores[family]++;
            }
        }
    }
    
    let maxScore = 0;
    let detectedFamily = 'UNKNOWN';
    
    for (const family in scores) {
        const score = scores[family];
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

// Main detection function
async function detectFilter(query) {
    try {
        console.log('=== FILTER DETECTION START ===');
        console.log('Query:', query);
        
        // Step 1: Search in Google Sheets
        console.log('Step 1: Searching in Google Sheets...');
        const sheetsResult = await searchInGoogleSheets(query);
        
        if (sheetsResult.found) {
            console.log('SUCCESS: Filter found in database');
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
        
        // Step 2: Pattern detection
        console.log('Step 2: Filter not found in database, using pattern detection...');
        
        const familyDetection = detectFilterFamily(query);
        console.log('Family detected:', familyDetection.family, 'Confidence:', familyDetection.confidence);
        
        const dutyClassification = classifyDutyLevel(query);
        console.log('Duty level:', dutyClassification.dutyLevel, 'Confidence:', dutyClassification.confidence);
        
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
            warning: 'Filter not found in database. Results based on pattern detection.',
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('ERROR in detectFilter:', error.message);
        return {
            success: false,
            error: error.message,
            query: query,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = {
    detectFilter,
    searchInGoogleSheets,
    classifyDutyLevel,
    detectFilterFamily,
    setSheetsInstance
};
"""

# Guardar con encoding ASCII estricto
with open('detectionService_ULTRA_CLEAN.js', 'w', encoding='ascii', errors='strict') as f:
    f.write(detection_new)

# Verificar que NO tiene caracteres especiales
with open('detectionService_ULTRA_CLEAN.js', 'rb') as f:
    content_bytes = f.read()

non_ascii = [b for b in content_bytes if b > 127]

print("=" * 70)
print("NUEVO detectionService.js CREADO DESDE CERO")
print("=" * 70)
print(f"Lineas: {len(detection_new.splitlines())}")
print(f"Caracteres: {len(detection_new)}")
print(f"Bytes no-ASCII: {len(non_ascii)}")
print(f"Encoding: ASCII puro")

if non_ascii:
    print(f"\nADVERTENCIA: Aun hay {len(non_ascii)} bytes no-ASCII")
else:
    print("\nSUCCESS: 100% ASCII - Sin caracteres especiales")
    print("\nArchivo: detectionService_ULTRA_CLEAN.js")
    print("\nEste archivo es COMPLETAMENTE NUEVO y diferente al anterior")
