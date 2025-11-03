const detectionService = {
  detectFilter: async (query) => {
    const result = {
      query_norm: query,
      sku: '',
      family: 'UNKNOWN',
      duty: 'UNKNOWN',
      filter_type: '',
      description: '',
      oem_codes: '',
      cross_reference: '',
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
      iso_main_efficiency_percent: '',
      iso_test_method: '',
      beta_200: '',
      hydrostatic_burst_psi: '',
      dirt_capacity_grams: '',
      rated_flow_cfm: '',
      rated_flow_gpm: '',
      panel_width_mm: '',
      panel_depth_mm: '',
      manufacturing_standards: 'ISO 9001, TS16949',
      certification_standards: 'OEM Spec Equivalent',
      operating_pressure_min_psi: '',
      operating_pressure_max_psi: '',
      operating_temperature_min_c: '',
      operating_temperature_max_c: '',
      fluid_compatibility: '',
      disposal_method: 'Standard recycling procedure',
      weight_grams: '',
      category: '',
      name: '',
      description_full: ''
    };

    const q = query.toUpperCase();

    // --- FAMILY DETECTION ---
    if (/(AIR|CA|CF|RS|P1|EAF)/.test(q)) result.family = 'AIR';
    else if (/(OIL|ACEITE|LUBE|1R|PH|LF|B|BT)/.test(q)) result.family = 'OIL';
    else if (/(CABIN|A\/C|AC|CABINA)/.test(q)) result.family = 'CABIN';
    else if (/(HYDRAULIC|HIDRAULICO|HF)/.test(q)) result.family = 'HYDRAULIC';
    else if (/(COOLANT|REFRIGERANTE)/.test(q)) result.family = 'COOLANT';
    else if (/(SEPARATOR|SEPARADOR|PS)/.test(q)) result.family = 'FUEL SEPARATOR';
    else if (/(TURBINE|PARKER)/.test(q)) result.family = 'TURBINE SERIES';
    else if (/(KIT|ENGINE)/.test(q)) result.family = 'ENGINE KIT';

    // --- DUTY DETECTION ---
    const dieselMakers = /(CATERPILLAR|MACK|KOMATSU|VOLVO|JOHN\s*DEERE|DETROIT|CUMMINS)/;
    const gasolineMakers = /(TOYOTA|FORD|MAZDA|LEXUS|NISSAN|BMW|MERCEDES|HONDA|CHEVROLET)/;
    if (dieselMakers.test(q)) result.duty = 'HD';
    else if (gasolineMakers.test(q)) result.duty = 'LD';

    // --- PREFIX MAPPING ---
    const prefixMap = {
      AIR: 'EA1', OIL: 'EL8', CABIN: 'EC1', HYDRAULIC: 'EH6',
      COOLANT: 'EW7', 'FUEL SEPARATOR': 'ES9', 'TURBINE SERIES': 'ET9',
      'ENGINE KIT': 'EK5'
    };

    const prefix = prefixMap[result.family] || 'EXX';
    const numeric = q.match(/(\d{4})$/);
    const last4 = numeric ? numeric[1] : '0000';
    result.sku = `${prefix}${last4}`;

    // --- NEUTRAL DESCRIPTION ---
    const descByFamily = {
      AIR: 'High-efficiency air filter for heavy-duty applications.',
      OIL: 'Lubrication filter for engine protection and performance.',
      CABIN: 'Cabin air filter for occupant comfort and air quality.',
      HYDRAULIC: 'Hydraulic system filter for contamination control.',
      COOLANT: 'Coolant filter for maintaining optimal fluid conditions.',
      'FUEL SEPARATOR': 'Fuel-water separation filter for diesel systems.',
      'TURBINE SERIES': 'High-flow turbine filter for heavy-duty systems.',
      'ENGINE KIT': 'Filter kit for internal combustion engines.'
    };
    result.description = descByFamily[result.family] || 'General-purpose filtration element.';

    return result;
  }
};

module.exports = detectionService;
