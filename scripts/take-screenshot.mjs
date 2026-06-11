import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  
  // Click the search button
  await page.click('[data-testid="activity-search"]');
  
  // Take a screenshot
  await page.screenshot({ path: 'screenshot.png' });
  
  await browser.close();
})();
