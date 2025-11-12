// donaldsonScraper.js v2.0.0 - CON AXIOS + CHEERIO (Sin Puppeteer)
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Busca código Donaldson desde OEM
 */
async function searchDonaldsonEquivalent(oemCode) {
  console.log(`🔍 [Donaldson] Buscando equivalente para: ${oemCode}`);

  try {
    const searchUrl = `https://www.donaldson.com/en-us/cross-reference/?q=${encodeURIComponent(oemCode)}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    let donaldsonCode = null;
    const selectors = ['.donaldson-part', '.part-number', '[data-part-number]', '.product-number', 'td:contains("Donaldson")', '.cross-reference td'];

    for (const selector of selectors) {
      $(selector).each((i, elem) => {
        if (donaldsonCode) return;
        const text = $(elem).text().trim();
        const match = text.match(/P\d{6}/);
        if (match) donaldsonCode = match[0];
      });
      if (donaldsonCode) break;
    }

    if (!donaldsonCode) {
      const bodyText = $('body').text();
      const match = bodyText.match(/P\d{6}/);
      if (match) donaldsonCode = match[0];
    }

    if (donaldsonCode) {
      console.log(`✅ [Donaldson] Encontrado: ${oemCode} → ${donaldsonCode}`);
      return donaldsonCode;
    }

    console.log(`⚠️ [Donaldson] No se encontró equivalente para: ${oemCode}`);
    return null;
  } catch (error) {
    console.error(`❌ [Donaldson] Error buscando: ${error.message}`);
    return null;
  }
}

/**
 * Scrape página de producto Donaldson
 */
async function scrapeDonaldsonProductPage(donaldsonCode) {
  console.log(`📄 [Donaldson] Scraping: ${donaldsonCode}`);

  try {
    const productUrl = `https://www.donaldson.com/en-us/industrial/products/${donaldsonCode}`;
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

    $('.cross-reference, .competitor-part, .interchange').each((i, elem) => {
      if (data.cross_references.length < 10) {
        const text = $(elem).text().trim();
        if (text && text.length > 3 && text.length < 50) {
          data.cross_references.push(text);
        }
      }
    });

    $('.oem-code, .oem-number, .original-equipment').each((i, elem) => {
      if (data.oem_codes.length < 10) {
        const text = $(elem).text().trim();
        if (text && text.length > 3 && text.length < 30) {
          data.oem_codes.push(text);
        }
      }
    });

    $('.engine-application, .engine, .motor-application').each((i, elem) => {
      if (data.engine_applications.length < 10) {
        const text = $(elem).text().trim();
        if (text && text.length > 5 && text.length < 100) {
          data.engine_applications.push(text);
        }
      }
    });

    $('.equipment-application, .vehicle-application, .machine-application').each((i, elem) => {
      if (data.equipment_applications.length < 10) {
        const text = $(elem).text().trim();
        if (text && text.length > 5 && text.length < 100) {
          data.equipment_applications.push(text);
        }
      }
    });

    $('.specification, .spec, .technical-data').each((i, elem) => {
      const label = $(elem).find('.label, .spec-name').text().trim();
      const value = $(elem).find('.value, .spec-value').text().trim();

      if (label && value) {
        if (label.toLowerCase().includes('flow')) data.specs.rated_flow_gpm = value.replace(/[^\d.]/g, '');
        if (label.toLowerCase().includes('service') || label.toLowerCase().includes('life')) data.specs.service_life_hours = value.replace(/[^\d.]/g, '');
        if (label.toLowerCase().includes('micron')) data.specs.micron_rating = value.replace(/[^\d.]/g, '');
        if (label.toLowerCase().includes('pressure')) data.specs.collapse_pressure_psi = value.replace(/[^\d.]/g, '');
      }
    });

    const descSelectors = ['.product-description', '.description', '[itemprop="description"]', '.overview', 'meta[name="description"]'];
    for (const selector of descSelectors) {
      const desc = $(selector).attr('content') || $(selector).text().trim();
      if (desc && desc.length > 20) {
        data.description = desc.substring(0, 500);
        break;
      }
    }

    console.log(`✅ [Donaldson] Datos extraídos: ${data.cross_references.length} refs, ${data.oem_codes.length} OEMs`);
    return data;
  } catch (error) {
    console.error(`❌ [Donaldson] Error scraping: ${error.message}`);
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
async function getDonaldsonData(oemCode) {
  console.log(`🚀 [Donaldson] Proceso completo: ${oemCode}`);
  try {
    const donaldsonCode = await searchDonaldsonEquivalent(oemCode);
    if (!donaldsonCode) {
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
    const productData = await scrapeDonaldsonProductPage(donaldsonCode);
    return { found: true, donaldson_code: donaldsonCode, ...productData };
  } catch (error) {
    console.error(`❌ [Donaldson] Error proceso completo: ${error.message}`);
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
}

module.exports = {
  searchDonaldsonEquivalent,
  scrapeDonaldsonProductPage,
  getDonaldsonData
};
