// content.js — Brillitos Store Chrome Extension
// Scrapes product info from Shein, Temu, Amazon

function getStore() {
  const h = window.location.hostname;
  if (h.includes('shein')) return 'Shein';
  if (h.includes('temu')) return 'Temu';
  if (h.includes('amazon')) return 'Amazon';
  return 'Otra';
}

function cleanPrice(str) {
  if (!str) return null;
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? null : num;
}

function getProductData() {
  const store = getStore();
  let name = null, price = null, image = null, url = window.location.href;

  if (store === 'Shein') {
    // Name
    name = document.querySelector('.product-intro__head-name, h1.goods-name, [class*="goodsName"], .product-title')?.textContent?.trim();
    // Price — prefer sale price
    const priceEl = document.querySelector(
      '.product-intro__head-price .from, .S-price-content__sale-price, [class*="sale-price"], .product-price .from, .original-price'
    );
    price = cleanPrice(priceEl?.textContent);
    if (!price) {
      const allPrices = document.querySelectorAll('[class*="price"]');
      for (const el of allPrices) {
        const p = cleanPrice(el.textContent);
        if (p && p > 0 && p < 999) { price = p; break; }
      }
    }
    // Image
    image = document.querySelector('.product-intro__main-img img, .j-expose__main-img img, [class*="mainImg"] img')?.src
      || document.querySelector('.crop-image-container img, .product-image img')?.src;
  }

  else if (store === 'Temu') {
    name = document.querySelector('h1, [class*="title"][class*="goods"], [data-testid="goods-title"]')?.textContent?.trim();
    const priceEl = document.querySelector('[class*="price-current"], [class*="sale-price"], [data-testid="price"]');
    price = cleanPrice(priceEl?.textContent);
    image = document.querySelector('[class*="goods-img"] img, [class*="product-img"] img, .swiper-slide img')?.src;
  }

  else if (store === 'Amazon') {
    name = document.querySelector('#productTitle, #title')?.textContent?.trim();
    // Try multiple price selectors
    const priceSelectors = [
      '.a-price.a-text-price.a-size-medium .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price .a-offscreen',
      '#apex_desktop_newAccordionRow .a-offscreen',
      '[data-feature-name="priceInsideBuyBox"] .a-offscreen',
      '.reinventPricePriceToPayMargin .a-offscreen',
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) { price = cleanPrice(el.textContent); if (price) break; }
    }
    image = document.querySelector('#landingImage, #imgBlkFront, #main-image')?.src
      || document.querySelector('[data-old-hires], #imageBlock img')?.src;
  }

  // Fallback: try og meta tags
  if (!name) name = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
  if (!image) image = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (!price) {
    const ogPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content');
    if (ogPrice) price = parseFloat(ogPrice);
  }

  return { store, name: name || '', price: price || 0, image: image || '', url };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getProductData') {
    sendResponse(getProductData());
  }
  return true;
});