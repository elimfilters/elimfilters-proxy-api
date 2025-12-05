const puppeteer = require('puppeteer');

async function searchMercruiserEquivalent(oemCode) {
  console.log(\🔍 [Mercruiser] Buscando equivalente para: \\);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    const searchUrl = 'https://www.mercruiser.com/products';
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    
    await page.waitForSelector('input[type="search"], input#search', { timeout: 5000 });
    await page.type('input[type="search"], input#search', oemCode);
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.keyboard.press('Enter')
    ]);
    
    await page.waitForTimeout(2000);
    
    const mercruiserCode = await page.evaluate(() => {
      const bodyText = document.body.textContent;
      const match = bodyText.match(/\d{6,}/);
      return match ? match[0] : null;
    });
    
    await browser.close();
    
    if (mercruiserCode) {
      console.log(\✅ [Mercruiser] Encontrado: \ → \\);
      return mercruiserCode;
    } else {
      console.log(\⚠️ [Mercruiser] No se encontró equivalente\);
      return null;
    }
  } catch (error) {
    console.error(\❌ [Mercruiser] Error:\, error.message);
    if (browser) await browser.close();
    return null;
  }
}

async function scrapeMercruiserProductPage(mercruiserCode) {
  console.log(\📄 [Mercruiser] Scraping: \\);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    const productUrl = \https://www.mercruiser.com/products/\\;
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
    console.log(\✅ [Mercruiser] Datos extraídos\);
    return data;
    
  } catch (error) {
    console.error(\❌ [Mercruiser] Error scraping:\, error.message);
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

async function getMercruiserData(oemCode) {
  console.log(\🚀 [Mercruiser] Proceso completo para: \\);
  
  const mercruiserCode = await searchMercruiserEquivalent(oemCode);
  
  if (!mercruiserCode) {
    return {
      found: false,
      mercruiser_code: null,
      cross_references: [],
      oem_codes: [],
      engine_applications: [],
      equipment_applications: [],
      specs: {},
      description: ''
    };
  }
  
  const productData = await scrapeMercruiserProductPage(mercruiserCode);
  
  return {
    found: true,
    mercruiser_code: mercruiserCode,
    ...productData
  };
}

module.exports = {
  searchMercruiserEquivalent,
  scrapeMercruiserProductPage,
  getMercruiserData
};
