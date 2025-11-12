// scrapers/framScraper.js v1.0.0
// Scraper completo de FRAM: busca equivalente y extrae toda la información (Light Duty)

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

/**
 * Busca el equivalente FRAM de un código OEM
 * @param {string} oemCode - Código OEM original (ej: "90915-YZZD2")
 * @returns {Promise<string|null>} - Código FRAM (ej: "PH8A") o null
 */
async function searchFRAMEquivalent(oemCode) {
  console.log(`🔍 [FRAM] Buscando equivalente para: ${oemCode}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // URL de búsqueda de FRAM
    const searchUrl = 'https://www.framcatalog.com/';
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    
    // Buscar campo de búsqueda
    await page.waitForSelector('input[type="search"], input#search, input.search-input', { timeout: 5000 });
    
    // Ingresar código OEM
    await page.type('input[type="search"], input#search, input.search-input', oemCode);
    
    // Submit búsqueda
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.keyboard.press('Enter')
    ]);
    
    // Esperar resultados
    await page.waitForTimeout(2000);
    
    // Extraer código FRAM de los resultados
    const framCode = await page.evaluate(() => {
      // Buscar en diferentes posibles selectores
      const selectors = [
        '.fram-part',
        '.part-number',
        '[data-fram-number]',
        '.result-part',
        'td.fram',
        'span.fram-code',
        '.product-number'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent || element.getAttribute('data-fram-number');
          // Buscar patrón FRAM típico: PH, CA, CS, CF, etc. seguido de dígitos
          const match = text.match(/(PH|CA|CS|CF|FS|CH|BG|G)\d{3,}/);
          if (match) return match[0];
        }
      }
      
      // Fallback: buscar en todo el texto
      const bodyText = document.body.textContent;
      const match = bodyText.match(/(PH|CA|CS|CF|FS|CH|BG|G)\d{3,}/);
      return match ? match[0] : null;
    });
    
    await browser.close();
    
    if (framCode) {
      console.log(`✅ [FRAM] Encontrado: ${oemCode} → ${framCode}`);
      return framCode;
    } else {
      console.log(`⚠️ [FRAM] No se encontró equivalente para: ${oemCode}`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ [FRAM] Error buscando equivalente:`, error.message);
    if (browser) await browser.close();
    return null;
  }
}

/**
 * Scrape página completa de producto FRAM
 * @param {string} framCode - Código FRAM (ej: "PH8A")
 * @returns {Promise<object>} - Objeto con toda la información extraída
 */
async function scrapeFRAMProductPage(framCode) {
  console.log(`📄 [FRAM] Scraping página de: ${framCode}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // URL del producto FRAM
    const productUrl = `https://www.framcatalog.com/product/${framCode}`;
    
    await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForTimeout(2000);
    
    // Extraer toda la información
    const data = await page.evaluate(() => {
      const result = {
        cross_references: [],
        oem_codes: [],
        engine_applications: [],
        equipment_applications: [],
        specs: {},
        description: ''
      };
      
      // Extraer cross-references
      document.querySelectorAll('.cross-reference, .competitor-part, [data-cross-ref], .interchange').forEach(el => {
        if (result.cross_references.length < 10) {
          const text = el.textContent.trim();
          if (text && text.length > 3) {
            result.cross_references.push(text);
          }
        }
      });
      
      // Extraer OEM codes
      document.querySelectorAll('.oem-code, .oem-number, [data-oem], .original-equipment').forEach(el => {
        if (result.oem_codes.length < 10) {
          const text = el.textContent.trim();
          if (text && text.length > 3) {
            result.oem_codes.push(text);
          }
        }
      });
      
      // Extraer engine applications
      document.querySelectorAll('.engine-application, .engine, [data-engine], .motor').forEach(el => {
        if (result.engine_applications.length < 10) {
          const text = el.textContent.trim();
          if (text && text.length > 5) {
            result.engine_applications.push(text);
          }
        }
      });
      
      // Extraer equipment applications (vehículos)
      document.querySelectorAll('.vehicle-application, .vehicle, [data-vehicle], .equipment, .make-model').forEach(el => {
        if (result.equipment_applications.length < 10) {
          const text = el.textContent.trim();
          if (text && text.length > 5) {
            result.equipment_applications.push(text);
          }
        }
      });
      
      // Extraer specs
      const specsMap = {
        'Flow': 'rated_flow_gpm',
        'Service': 'service_life_hours',
        'Micron': 'micron_rating',
        'Interval': 'change_interval_km'
      };
      
      document.querySelectorAll('.specification, .spec, [data-spec]').forEach(el => {
        const label = el.querySelector('.label, .spec-name')?.textContent.trim();
        const value = el.querySelector('.value, .spec-value')?.textContent.trim();
        
        if (label && value) {
          for (const [key, field] of Object.entries(specsMap)) {
            if (label.includes(key)) {
              result.specs[field] = value.replace(/[^\d.]/g, '');
            }
          }
        }
      });
      
      // Extraer descripción
      const descEl = document.querySelector('.description, .product-description, [data-description]');
      if (descEl) {
        result.description = descEl.textContent.trim();
      }
      
      return result;
    });
    
    await browser.close();
    
    console.log(`✅ [FRAM] Datos extraídos:`, {
      cross_refs: data.cross_references.length,
      oem_codes: data.oem_codes.length,
      engines: data.engine_applications.length,
      equipment: data.equipment_applications.length
    });
    
    return data;
    
  } catch (error) {
    console.error(`❌ [FRAM] Error scraping producto:`, error.message);
    if (browser) await browser.close();
    
    // Retornar objeto vacío en caso de error
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
 * Función completa: busca equivalente y scrape página
 * @param {string} oemCode - Código OEM original
 * @returns {Promise<object>} - Objeto completo con código FRAM y todos los datos
 */
async function getFRAMData(oemCode) {
  console.log(`🚀 [FRAM] Proceso completo para: ${oemCode}`);
  
  // 1. Buscar equivalente
  const framCode = await searchFRAMEquivalent(oemCode);
  
  if (!framCode) {
    console.log(`⚠️ [FRAM] No se encontró equivalente, retornando vacío`);
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
  
  // 2. Scrape página completa
  const productData = await scrapeFRAMProductPage(framCode);
  
  // 3. Combinar resultados
  return {
    found: true,
    fram_code: framCode,
    ...productData
  };
}

module.exports = {
  searchFRAMEquivalent,
  scrapeFRAMProductPage,
  getFRAMData
};
