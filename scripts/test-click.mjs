import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  
  // Click the model select dropdown
  console.log('Clicking model select...');
  await page.click('[data-testid="agent-model-select"]');
  
  // Wait a bit to let it open
  await page.waitForTimeout(1000);
  
  // Take screenshot
  await page.screenshot({ path: 'screenshot2.png' });
  
  await browser.close();
})();
