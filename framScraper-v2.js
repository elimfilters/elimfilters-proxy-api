// framScraper.js v2.0.0 - CON AXIOS + CHEERIO (Sin Puppeteer)
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Busca código FRAM desde OEM
 */
async function searchFRAMEquivalent(oemCode) {
  console.log(`🔍 [FRAM] Buscando equivalente para: ${oemCode}`);
  
  try {
    // URL de búsqueda FRAM
    const searchUrl = `https://www.framcatalog.com/search?q=${encodeURIComponent(oemCode)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    // Buscar código FRAM
    let framCode = null;
    
    const selectors = [
      '.fram-part',
      '.part-number',
      '[data-part-number]',
      '.product-number',
      'td:contains("FRAM")',
      '.search-result .part'
    ];
    
    for (const selector of selectors) {
      $(selector).each((i, elem) => {
        if (framCode) return;
        const text = $(elem).text().trim();
        // FRAM patterns: PH, CA, CS, CF, FS, CH, BG, G seguido de dígitos
        const match = text.match(/(PH|CA|CS|CF|FS|CH|BG|G)\d{3,}/);
        if (match) {
          framCode = match[0];
        }
      });
      if (framCode) break;
    }
    
    // Fallback: buscar en todo el texto
    if (!framCode) {
      const bodyText = $('body').text();
      const match = bodyText.match(/(PH|CA|CS|CF|FS|CH|BG|G)\d{3,}/);
      if (match) framCode = match[0];
    }
    
    if (framCode) {
      console.log(`✅ [FRAM] Encontrado: ${oemCode} → ${framCode}`);
      return framCode;
    }
    
    console.log(`⚠️ [FRAM] No se encontró equivalente para: ${oemCode}`);
    return null;
    
  } catch (error) {
    console.error(`❌ [FRAM] Error buscando: ${error.message}`);
    return null;
  }
}

/**
 * Scrape página de producto FRAM
 */
async function scrapeFRAMProductPage(framCode) {
  console.log(`📄 [FRAM] Scraping: ${framCode}`);
  
  try {
    const productUrl = `https://www.framcatalog.com/product/${framCode}`;
    
    const response = await axios.get(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    const data = {
      cross_references: [],
      oem_codes: [],
      engine_applications: [],
      equipment_applications: [],
      specs: {},
      description: ''
    };
    
    // Extraer cross-references
    $('.cross-reference, .interchange, .competitor-part').each((i, elem) => {
      if (data.cross_references.length < 10) {
        const text = $(elem).text().trim();
        if (text && text.length > 3 && text.length < 50) {
          data.cross_references.push(text);
        }
      }
    });
    
    // Extraer OEM codes
    $('.oem-code, .oem-number, .original-equipment, .oem').each((i, elem) => {
      if (data.oem_codes.length < 10) {
        const text = $(elem).text().trim();
        if (text && text.length > 3 && text.length < 30) {
          data.oem_codes.push(text);
        }
      }
    });
    
    // Extraer engine applications
    $('.engine-application, .engine, .motor').each((i, elem) => {
      if (data.engine_applications.length < 10) {
        const text = $(elem).text().trim();
        if (text && text.length > 5 && text.length < 100) {
          data.engine_applications.push(text);
        }
      }
    });
    
    // Extraer vehicle/equipment applications
    $('.vehicle-application, .vehicle, .equipment, .make-model').each((i, elem) => {
      if (data.equipment_applications.length < 10) {
        const text = $(elem).text().trim();
        if (text && text.length > 5 && text.length < 100) {
          data.equipment_applications.push(text);
        }
      }
    });
    
    // Extraer specs
    $('.specification, .spec, .technical').each((i, elem) => {
      const label = $(elem).find('.label, .name').text().trim();
      const value = $(elem).find('.value, .data').text().trim();
      
      if (label && value) {
        if (label.toLowerCase().includes('flow')) {
          data.specs.rated_flow_gpm = value.replace(/[^\d.]/g, '');
        }
        if (label.toLowerCase().includes('service') || label.toLowerCase().includes('life')) {
          data.specs.service_life_hours = value.replace(/[^\d.]/g, '');
        }
        if (label.toLowerCase().includes('interval')) {
          const miles = value.replace(/[^\d.]/g, '');
          if (miles) {
            data.specs.change_interval_km = Math.round(parseFloat(miles) * 1.60934).toString();
          }
        }
        if (label.toLowerCase().includes('micron')) {
          data.specs.micron_rating = value.replace(/[^\d.]/g, '');
        }
      }
    });
    
    // Extraer descripción
    const descSelectors = [
      '.product-description',
      '.description',
      '[itemprop="description"]',
      'meta[name="description"]',
      '.product-details'
    ];
    
    for (const selector of descSelectors) {
      const desc = $(selector).attr('content') || $(selector).text().trim();
      if (desc && desc.length > 20) {
        data.description = desc.substring(0, 500);
        break;
      }
    }
    
    console.log(`✅ [FRAM] Datos extraídos: ${data.cross_references.length} refs, ${data.oem_codes.length} OEMs`);
    
    return data;
    
  } catch (error) {
    console.error(`❌ [FRAM] Error scraping: ${error.message}`);
    return {
      cross_references: [],
      oem_codes: [],
      engine_applications: [],
      equipment_applications: [],
      specs: {},
      description: ''
    };
  }
}

/**
 * Función completa: busca + scrape
 */
async function getFRAMData(oemCode) {
  console.log(`🚀 [FRAM] Proceso completo: ${oemCode}`);
  
  try {
    // 1. Buscar equivalente
    const framCode = await searchFRAMEquivalent(oemCode);
    
    if (!framCode) {
      return {
        found: false,
        fram_code: null,
        cross_references: [],
        oem_codes: [],
        engine_applications: [],
        equipment_applications: [],
        specs: {},
        description: ''
      };
    }
    
    // 2. Scrape página
    const productData = await scrapeFRAMProductPage(framCode);
    
    // 3. Combinar
    return {
      found: true,
      fram_code: framCode,
      ...productData
    };
    
  } catch (error) {
    console.error(`❌ [FRAM] Error proceso completo: ${error.message}`);
    return {
      found: false,
      fram_code: null,
      cross_references: [],
      oem_codes: [],
      engine_applications: [],
      equipment_applications: [],
      specs: {},
      description: ''
    };
  }
}

module.exports = {
  searchFRAMEquivalent,
  scrapeFRAMProductPage,
  getFRAMData
};
