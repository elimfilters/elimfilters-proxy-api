const puppeteer = require('puppeteer');

async function searchMercuryEquivalent(oemCode) {
  console.log(\🔍 [Mercury] Buscando equivalente para: \\);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    const searchUrl = 'https://www.mercurymarineparts.com/products';
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    
    await page.waitForSelector('input[type="search"], input#search', { timeout: 5000 });
    await page.type('input[type="search"], input#search', oemCode);
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.keyboard.press('Enter')
    ]);
    
    await page.waitForTimeout(2000);
    
    const mercuryCode = await page.evaluate(() => {
      const bodyText = document.body.textContent;
      const match = bodyText.match(/(\d{6,}|8M\d{6,})/);
      return match ? match[0] : null;
    });
    
    await browser.close();
    
    if (mercuryCode) {
      console.log(\✅ [Mercury] Encontrado: \ → \\);
      return mercuryCode;
    } else {
      console.log(\⚠️ [Mercury] No se encontró equivalente\);
      return null;
    }
  } catch (error) {
    console.error(\❌ [Mercury] Error:\, error.message);
    if (browser) await browser.close();
    return null;
  }
}

async function scrapeMercuryProductPage(mercuryCode) {
  console.log(\📄 [Mercury] Scraping: \\);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    const productUrl = \https://www.mercurymarineparts.com/products/\\;
    await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForTimeout(2000);
    
    const data = await page.evaluate(() => ({
      cross_references: [],
      oem_codes: [],
      engine_applications: [],
      equipment_applications: [],
      specs: {},
      description: document.querySelector('.description, .product-description')?.textContent.trim() || ''
    }));
    
    await browser.close();
    console.log(\✅ [Mercury] Datos extraídos\);
    return data;
    
  } catch (error) {
    console.error(\❌ [Mercury] Error scraping:\, error.message);
    if (browser) await browser.close();
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

async function getMercuryData(oemCode) {
  console.log(\🚀 [Mercury] Proceso completo para: \\);
  
  const mercuryCode = await searchMercuryEquivalent(oemCode);
  
  if (!mercuryCode) {
    return {
      found: false,
      mercury_code: null,
      cross_references: [],
      oem_codes: [],
      engine_applications: [],
      equipment_applications: [],
      specs: {},
      description: ''
    };
  }
  
  const productData = await scrapeMercuryProductPage(mercuryCode);
  
  return {
    found: true,
    mercury_code: mercuryCode,
    ...productData
  };
}

module.exports = {
  searchMercuryEquivalent,
  scrapeMercuryProductPage,
  getMercuryData
};
