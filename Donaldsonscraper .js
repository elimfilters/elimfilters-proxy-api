// scrapers/donaldsonScraper.js v1.0.0
// Scraper completo de Donaldson: busca equivalente y extrae toda la información

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

/**
 * Busca el equivalente Donaldson de un código OEM
 * @param {string} oemCode - Código OEM original (ej: "1R1807")
 * @returns {Promise<string|null>} - Código Donaldson (ej: "P550388") o null
 */
async function searchDonaldsonEquivalent(oemCode) {
  console.log(`🔍 [Donaldson] Buscando equivalente para: ${oemCode}`);
  
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
    
    // URL de cross-reference de Donaldson
    const searchUrl = 'https://www.donaldson.com/en-us/cross-reference/';
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    
    // Buscar campo de búsqueda
    await page.waitForSelector('input[name="SearchTerm"], input#search-input, input[type="search"]', { timeout: 5000 });
    
    // Ingresar código OEM
    await page.type('input[name="SearchTerm"], input#search-input, input[type="search"]', oemCode);
    
    // Submit form
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.click('button[type="submit"], input[type="submit"], button.search-button')
    ]);
    
    // Esperar resultados
    await page.waitForTimeout(2000);
    
    // Extraer código Donaldson de los resultados
    const donaldsonCode = await page.evaluate(() => {
      // Buscar en diferentes posibles selectores
      const selectors = [
        '.donaldson-part',
        '.part-number',
        '[data-part-number]',
        '.result-part-number',
        'td.donaldson',
        'span.donaldson-code'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent || element.getAttribute('data-part-number');
          // Buscar patrón P seguido de 6 dígitos
          const match = text.match(/P\d{6}/);
          if (match) return match[0];
        }
      }
      
      // Fallback: buscar en todo el texto de la página
      const bodyText = document.body.textContent;
      const match = bodyText.match(/P\d{6}/);
      return match ? match[0] : null;
    });
    
    await browser.close();
    
    if (donaldsonCode) {
      console.log(`✅ [Donaldson] Encontrado: ${oemCode} → ${donaldsonCode}`);
      return donaldsonCode;
    } else {
      console.log(`⚠️ [Donaldson] No se encontró equivalente para: ${oemCode}`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ [Donaldson] Error buscando equivalente:`, error.message);
    if (browser) await browser.close();
    return null;
  }
}

/**
 * Scrape página completa de producto Donaldson
 * @param {string} donaldsonCode - Código Donaldson (ej: "P550388")
 * @returns {Promise<object>} - Objeto con toda la información extraída
 */
async function scrapeDonaldsonProductPage(donaldsonCode) {
  console.log(`📄 [Donaldson] Scraping página de: ${donaldsonCode}`);
  
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
    
    // URL del producto
    const productUrl = `https://www.donaldson.com/en-us/industrial-dust-fume-mist/products/${donaldsonCode}`;
    
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
      document.querySelectorAll('.cross-reference-item, .competitor-part, [data-cross-ref]').forEach(el => {
        if (result.cross_references.length < 10) {
          const text = el.textContent.trim();
          if (text && text.length > 3) {
            result.cross_references.push(text);
          }
        }
      });
      
      // Extraer OEM codes
      document.querySelectorAll('.oem-code, .oem-part-number, [data-oem-code]').forEach(el => {
        if (result.oem_codes.length < 10) {
          const text = el.textContent.trim();
          if (text && text.length > 3) {
            result.oem_codes.push(text);
          }
        }
      });
      
      // Extraer engine applications
      document.querySelectorAll('.engine-application, .engine-fit, [data-engine]').forEach(el => {
        if (result.engine_applications.length < 10) {
          const text = el.textContent.trim();
          if (text && text.length > 5) {
            result.engine_applications.push(text);
          }
        }
      });
      
      // Extraer equipment applications
      document.querySelectorAll('.equipment-application, .vehicle-fit, [data-equipment]').forEach(el => {
        if (result.equipment_applications.length < 10) {
          const text = el.textContent.trim();
          if (text && text.length > 5) {
            result.equipment_applications.push(text);
          }
        }
      });
      
      // Extraer specs
      const specsMap = {
        'Flow Rate': 'rated_flow_gpm',
        'Service Life': 'service_life_hours',
        'Micron Rating': 'micron_rating',
        'Collapse Pressure': 'collapse_pressure_psi',
        'Change Interval': 'change_interval_km'
      };
      
      document.querySelectorAll('.spec-item, .specification, [data-spec]').forEach(el => {
        const label = el.querySelector('.spec-label, .label')?.textContent.trim();
        const value = el.querySelector('.spec-value, .value')?.textContent.trim();
        
        if (label && value) {
          for (const [key, field] of Object.entries(specsMap)) {
            if (label.includes(key)) {
              result.specs[field] = value.replace(/[^\d.]/g, '');
            }
          }
        }
      });
      
      // Extraer descripción
      const descEl = document.querySelector('.product-description, .description, [data-description]');
      if (descEl) {
        result.description = descEl.textContent.trim();
      }
      
      return result;
    });
    
    await browser.close();
    
    console.log(`✅ [Donaldson] Datos extraídos:`, {
      cross_refs: data.cross_references.length,
      oem_codes: data.oem_codes.length,
      engines: data.engine_applications.length,
      equipment: data.equipment_applications.length
    });
    
    return data;
    
  } catch (error) {
    console.error(`❌ [Donaldson] Error scraping producto:`, error.message);
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
 * @returns {Promise<object>} - Objeto completo con código Donaldson y todos los datos
 */
async function getDonaldsonData(oemCode) {
  console.log(`🚀 [Donaldson] Proceso completo para: ${oemCode}`);
  
  // 1. Buscar equivalente
  const donaldsonCode = await searchDonaldsonEquivalent(oemCode);
  
  if (!donaldsonCode) {
    console.log(`⚠️ [Donaldson] No se encontró equivalente, retornando vacío`);
    return {
      found: false,
      donaldson_code: null,
      cross_references: [],
      oem_codes: [],
      engine_applications: [],
      equipment_applications: [],
      specs: {},
      description: ''
    };
  }
  
  // 2. Scrape página completa
  const productData = await scrapeDonaldsonProductPage(donaldsonCode);
  
  // 3. Combinar resultados
  return {
    found: true,
    donaldson_code: donaldsonCode,
    ...productData
  };
}

module.exports = {
  searchDonaldsonEquivalent,
  scrapeDonaldsonProductPage,
  getDonaldsonData
};
