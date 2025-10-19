let sheetsInstance = null;

function setSheetsInstance(instance) {
    sheetsInstance = instance;
    console.log('Google Sheets instance configured in detectionService');
}

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

async function searchInGoogleSheets(query) {
    try {
        if (!sheetsInstance) {
            throw new Error('Google Sheets not initialized');
        }

        console.log('Searching in Google Sheets:', query);

        const queryNorm = query.toUpperCase().trim();
        const result = await sheetsInstance.searchInMaster(queryNorm);

        if (result && result.found) {
            console.log('Found in Google Sheets:', result.data.sku);
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
        console.error('Error searching in Google Sheets:', error);
        return {
            found: false,
            source: 'google_sheets',
            error: error.message
        };
    }
}

function classifyDutyLevel(context) {
    const contextUpper = context.toUpperCase();

    let hdScore = 0;
    let ldScore = 0;

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

async function detectFilter(query) {
    try {
        console.log('STARTING FILTER DETECTION');
        console.log('Query:', query);

        console.log('STEP 1: Google Sheets Search');
        const sheetsResult = await searchInGoogleSheets(query);

        if (sheetsResult.found) {
            console.log('Filter found in database');

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

        console.log('STEP 2: Pattern Detection');
        console.log('Not found in database, analyzing patterns...');

        const familyDetection = detectFilterFamily(query);
        console.log('Detected family:', familyDetection.family, 'confidence:', familyDetection.confidence);

        const dutyClassification = classifyDutyLevel(query);
        console.log('Duty Level:', dutyClassification.dutyLevel, 'confidence:', dutyClassification.confidence);

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
        console.error('Error in filter detection:', error);
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
