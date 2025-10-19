// Sistema de Detección Blindado para DUTY y FAMILY

// Normalizar código de filtro
function normalizeCode(code) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Generar SKU basado en family y código normalizado
function generateSKU(family, queryNorm) {
  const familyPrefixes = {
    'oil': 'OIL',
    'fuel': 'FUEL',
    'air': 'AIR',
    'cabin': 'CAB',
    'hydraulic': 'HYD',
    'air dryer': 'ADRYER',
    'coolant': 'COOL',
    'separator': 'SEP'
  };
  
  const prefix = familyPrefixes[family.toLowerCase()] || 'FILTER';
  return `${prefix}-${queryNorm}`;
}

// Validar combinación DUTY + FAMILY
function validateDutyForFamily(family, duty) {
  const validCombinations = {
    'oil': ['HD', 'LD'],
    'fuel': ['HD', 'LD'],
    'air': ['HD', 'LD'],
    'cabin': ['LD'],
    'hydraulic': ['HD'],
    'air dryer': ['HD'],
    'coolant': ['HD', 'LD'],
    'separator': ['HD']
  };
  
  const validDuties = validCombinations[family.toLowerCase()] || [];
  const isValid = validDuties.includes(duty);
  
  return {
    valid: isValid,
    validDuties,
    message: isValid ? 'Valid combination' : `${family} filters are typically ${validDuties.join(' or ')}`
  };
}

// CAPA 1: Búsqueda Web Potente
async function detectWithWebSearch(queryRaw) {
  console.log(`🔍 Starting web search for: ${queryRaw}`);
  
  // Simulación de búsqueda web (aquí integrarías tu API de búsqueda)
  // Por ahora retornamos estructura de ejemplo
  const searches = [
    `${queryRaw} filter specifications`,
    `site:filterslookup.com ${queryRaw}`,
    `site:partsgeek.com ${queryRaw}`,
    `site:rockauto.com ${queryRaw}`,
    `${queryRaw} "oil filter" OR "fuel filter" OR "air filter"`,
    `${queryRaw} cross reference filter`
  ];
  
  // TODO: Implementar llamada real a API de búsqueda web
  // Por ahora retornamos array vacío para testing
  return [];
}

// CAPA 2: Análisis de Resultados Web
function analyzeWebResults(results, queryNorm) {
  const analysis = {
    duty: { HD: 0, LD: 0 },
    family: {
      oil: 0,
      fuel: 0,
      air: 0,
      cabin: 0,
      hydraulic: 0,
      "air dryer": 0,
      coolant: 0,
      separator: 0
    },
    confidence: {
      duty: 'low',
      family: 'low'
    },
    sources: []
  };
  
  const dutyKeywords = {
    HD: {
      high: ["heavy duty", "heavy-duty", "hd filter", "class 8", "commercial truck"],
      medium: ["diesel", "industrial", "construction", "mining", "agricultural"],
      low: ["truck", "machinery", "equipment"]
    },
    LD: {
      high: ["light duty", "light-duty", "ld filter", "passenger car", "automobile"],
      medium: ["gasoline", "automotive", "consumer", "sedan", "suv"],
      low: ["car", "vehicle"]
    }
  };
  
  const familyKeywords = {
    oil: {
      high: ["oil filter", "lube filter", "lubrication filter"],
      medium: ["engine oil", "motor oil", "oil filtration"],
      low: ["oil"]
    },
    fuel: {
      high: ["fuel filter", "diesel filter", "fuel water separator"],
      medium: ["fuel filtration", "fuel system"],
      low: ["fuel"]
    },
    air: {
      high: ["air filter", "intake filter", "engine air filter"],
      medium: ["air filtration", "intake air"],
      low: ["air"]
    },
    cabin: {
      high: ["cabin filter", "cabin air filter", "hvac filter"],
      medium: ["air conditioning filter", "interior air"],
      low: ["cabin"]
    },
    hydraulic: {
      high: ["hydraulic filter", "hydraulic oil filter"],
      medium: ["hydraulic system", "transmission filter"],
      low: ["hydraulic"]
    },
    "air dryer": {
      high: ["air dryer filter", "air dryer cartridge"],
      medium: ["air brake", "compressed air"],
      low: ["air dryer"]
    },
    coolant: {
      high: ["coolant filter", "water filter", "radiator filter"],
      medium: ["cooling system"],
      low: ["coolant"]
    },
    separator: {
      high: ["separator", "fuel water separator", "oil separator"],
      medium: ["separation"],
      low: []
    }
  };
  
  // Analizar cada resultado
  for (const result of results) {
    const text = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
    
    // Verificar que el código esté presente
    if (!text.includes(queryNorm.toLowerCase())) {
      continue;
    }
    
    // Scoring para DUTY
    for (const [duty, levels] of Object.entries(dutyKeywords)) {
      for (const [level, keywords] of Object.entries(levels)) {
        const weight = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
        const matches = keywords.filter(kw => text.includes(kw)).length;
        analysis.duty[duty] += matches * weight;
      }
    }
    
    // Scoring para FAMILY
    for (const [family, levels] of Object.entries(familyKeywords)) {
      for (const [level, keywords] of Object.entries(levels)) {
        const weight = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
        const matches = keywords.filter(kw => text.includes(kw)).length;
        analysis.family[family] += matches * weight;
      }
    }
    
    analysis.sources.push({
      url: result.url,
      title: result.title,
      snippet: result.snippet
    });
  }
  
  // Calcular confianza
  const totalDutyScore = analysis.duty.HD + analysis.duty.LD;
  const totalFamilyScore = Math.max(...Object.values(analysis.family));
  
  analysis.confidence.duty = totalDutyScore >= 10 ? "high" : totalDutyScore >= 5 ? "medium" : "low";
  analysis.confidence.family = totalFamilyScore >= 10 ? "high" : totalFamilyScore >= 5 ? "medium" : "low";
  
  return analysis;
}

// CAPA 3: Validación con OpenAI (simulada por ahora)
async function validateWithOpenAI(queryRaw, webAnalysis) {
  console.log(`🤖 Validating with AI: ${queryRaw}`);
  
  // TODO: Implementar llamada real a OpenAI
  // Por ahora retornamos estructura de ejemplo
  return {
    is_valid_filter: true,
    duty: "unknown",
    family: "unknown",
    confidence: "low",
    reason: "AI validation not implemented yet",
    agrees_with_web: false
  };
}

// CAPA 4: Validación con FAMILY_RULES
async function validateWithFamilyRules(queryNorm, duty, sheetsService) {
  console.log(`📋 Validating with FAMILY_RULES: ${queryNorm}`);
  
  try {
    const rules = await sheetsService.getFamilyRules();
    
    for (const rule of rules) {
      // Validar por prefijo
      if (rule.match_type === "prefix" && queryNorm.startsWith(rule.pattern)) {
        if (rule.duty === "ANY" || rule.duty === duty) {
          return {
            family: rule.family,
            confidence: "high",
            source: "family_rules",
            rule: rule
          };
        }
      }
      
      // Validar por regex
      if (rule.match_type === "regex") {
        try {
          const regex = new RegExp(rule.pattern, "i");
          if (regex.test(queryNorm)) {
            if (rule.duty === "ANY" || rule.duty === duty) {
              return {
                family: rule.family,
                confidence: "high",
                source: "family_rules",
                rule: rule
              };
            }
          }
        } catch (e) {
          console.error(`Invalid regex pattern: ${rule.pattern}`);
        }
      }
      
      // Validar por rango
      if (rule.match_type === "range" && rule.min && rule.max) {
        const digits = queryNorm.replace(/\D/g, "");
        const num = parseInt(digits);
        if (!isNaN(num) && num >= rule.min && num <= rule.max) {
          if (rule.duty === "ANY" || rule.duty === duty) {
            return {
              family: rule.family,
              confidence: "medium",
              source: "family_rules",
              rule: rule
            };
          }
        }
      }
    }
    
    return { family: null, confidence: "none", source: "family_rules" };
  } catch (error) {
    console.error('Error validating with FAMILY_RULES:', error);
    return { family: null, confidence: "none", source: "family_rules", error: error.message };
  }
}

// SISTEMA DE CONSENSO PRINCIPAL
async function detectDutyAndFamily(queryRaw, queryNorm, sheetsService) {
  console.log(`\n🎯 Starting detection for: ${queryRaw}`);
  
  // PASO 1: Web Search
  const webResults = await detectWithWebSearch(queryRaw);
  const webAnalysis = analyzeWebResults(webResults, queryNorm);
  console.log(`📊 Web Analysis:`, webAnalysis);
  
  // PASO 2: OpenAI validation
  const aiValidation = await validateWithOpenAI(queryRaw, webAnalysis);
  console.log(`🤖 AI Validation:`, aiValidation);
  
  // PASO 3: Determinar DUTY por consenso
  let duty = null;
  let dutyConfidence = "low";
  
  const webDuty = webAnalysis.duty.HD > webAnalysis.duty.LD ? "HD" : "LD";
  const aiDuty = aiValidation.duty;
  
  if (webDuty === aiDuty && webAnalysis.confidence.duty !== "low") {
    duty = webDuty;
    dutyConfidence = webAnalysis.confidence.duty === "high" && aiValidation.confidence === "high" 
      ? "high" 
      : "medium";
  } else if (webAnalysis.confidence.duty === "high") {
    duty = webDuty;
    dutyConfidence = "medium";
  } else if (aiValidation.confidence === "high") {
    duty = aiDuty;
    dutyConfidence = "medium";
  }
  
  // Si no hay consenso en DUTY, usar HD por defecto (más común en filtros industriales)
  if (!duty || duty === "unknown") {
    duty = "HD";
    dutyConfidence = "low";
    console.log(`⚠️ No DUTY consensus, defaulting to HD`);
  }
  
  console.log(`✅ DUTY detected: ${duty} (confidence: ${dutyConfidence})`);
  
  // PASO 4: Validar con FAMILY_RULES
  const rulesValidation = await validateWithFamilyRules(queryNorm, duty, sheetsService);
  console.log(`📋 Rules Validation:`, rulesValidation);
  
  // PASO 5: Determinar FAMILY por consenso
  const webFamily = Object.keys(webAnalysis.family).reduce((a, b) => 
    webAnalysis.family[a] > webAnalysis.family[b] ? a : b
  );
  const aiFamily = aiValidation.family;
  
  let family = null;
  let familyConfidence = "low";
  
  // Sistema de votación
  const votes = [
    { family: webFamily, confidence: webAnalysis.confidence.family },
    { family: aiFamily, confidence: aiValidation.confidence },
    { family: rulesValidation.family, confidence: rulesValidation.confidence }
  ].filter(v => v.family && v.family !== "unknown");
  
  // Contar votos
  const voteCounts = {};
  for (const vote of votes) {
    voteCounts[vote.family] = (voteCounts[vote.family] || 0) + 1;
  }
  
  const maxVotes = Math.max(...Object.values(voteCounts), 0);
  const winner = Object.keys(voteCounts).find(f => voteCounts[f] === maxVotes);
  
  if (maxVotes >= 2) {
    family = winner;
    familyConfidence = "high";
  } else if (maxVotes === 1 && webAnalysis.confidence.family === "high") {
    family = webFamily;
    familyConfidence = "medium";
  } else if (rulesValidation.family) {
    family = rulesValidation.family;
    familyConfidence = rulesValidation.confidence;
  }
  
  // Si no hay consenso en FAMILY → FAIL
  if (!family || family === "unknown") {
    return {
      success: false,
      error: "family_detection_failed",
      data: { webAnalysis, aiValidation, rulesValidation, duty }
    };
  }
  
  console.log(`✅ FAMILY detected: ${family} (confidence: ${familyConfidence})`);
  
  // PASO 6: Validar combinación DUTY + FAMILY
  const validation = validateDutyForFamily(family, duty);
  
  if (!validation.valid) {
    console.log(`⚠️ Invalid combination: ${duty} + ${family}`);
    return {
      success: false,
      error: "invalid_duty_family_combination",
      data: { duty, family, validation }
    };
  }
  
  return {
    success: true,
    duty,
    family,
    confidence: {
      duty: dutyConfidence,
      family: familyConfidence
    },
    sources: {
      web: webAnalysis,
      ai: aiValidation,
      rules: rulesValidation
    }
  };
}

// Generar especificaciones con OpenAI (simulado)
async function generateSpecsWithOpenAI(sku, queryRaw, family, duty) {
  console.log(`📝 Generating specs for: ${sku}`);
  
  // TODO: Implementar llamada real a OpenAI para generar specs
  // Por ahora retornamos estructura básica
  return {
    query_norm: normalizeCode(queryRaw),
    sku: sku,
    oem_codes: queryRaw,
    cross_reference: '',
    filter_type: family,
    media_type: '',
    subtype: '',
    engine_applications: '',
    equipment_applications: '',
    height_mm: '',
    outer_diameter_mm: '',
    thread_size: '',
    gasket_od_mm: '',
    gasket_id_mm: '',
    bypass_valve_psi: '',
    micron_rating: '',
    duty: duty,
    iso_main_efficiency: '',
    iso_test_method: '',
    beta_200: '',
    hydrostatic_burst_min_psi: '',
    dirt_capacity_g: '',
    rated_flow: '',
    panel_width_mm: '',
    panel_depth_mm: ''
  };
}

// Enviar email a soporte (simulado)
async function sendSupportEmail(error, data) {
  console.log(`📧 Sending support email for error: ${error}`);
  console.log(`Data:`, JSON.stringify(data, null, 2));
  
  // TODO: Implementar envío real de email
  // Por ahora solo logueamos
}

module.exports = {
  normalizeCode,
  generateSKU,
  validateDutyForFamily,
  detectDutyAndFamily,
  generateSpecsWithOpenAI,
  sendSupportEmail
};
