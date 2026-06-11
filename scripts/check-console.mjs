import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  
  // Try to click the search button
  console.log('Clicking search tab...');
  await page.click('[data-testid="activity-search"]');
  
  // Wait a bit
  await page.waitForTimeout(1000);
  
  await browser.close();
})();
