const puppeteer = require('puppeteer'); 
(async () => { 
    const browser = await puppeteer.launch({headless: true}); 
    const page = await browser.newPage(); 
    await page.goto('https://toonily.com/', {waitUntil: 'domcontentloaded'}); 
    const html = await page.evaluate(() => document.querySelector('.comic-slider-section ul li')?.outerHTML); 
    console.log(html); 
    await browser.close(); 
})();
