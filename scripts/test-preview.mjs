import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text().substring(0, 200));
    }
  });
  
  console.log('1. Loading page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  // 2. Connect wallet
  console.log('2. Connecting wallet...');
  const fallbackBtn = page.locator('[data-testid="gate-connect-fallback-btn"]');
  if (await fallbackBtn.isVisible()) {
    await fallbackBtn.click();
    await page.waitForTimeout(2000);
  }
  
  // 3. Send a request to create a landing page
  console.log('3. Sending chat message to create landing page...');
  const chatInput = page.locator('[data-testid="chat-input"]');
  if (await chatInput.isVisible()) {
    await chatInput.fill('Create a beautiful landing page for a crypto project called NexusAI');
    await chatInput.press('Enter');
    console.log('   Message sent! Waiting 20s for AI response...');
    await page.waitForTimeout(20000);
  }
  
  // 4. Click on Split Preview
  console.log('4. Opening Split Preview...');
  const previewBtn = page.locator('[data-testid="preview-tab"]');
  if (await previewBtn.isVisible()) {
    await previewBtn.click();
    await page.waitForTimeout(3000); // Wait for iframe to load
  }
  
  // 5. Take final screenshot
  await page.screenshot({ path: 'test-preview-result.png', fullPage: false });
  console.log('   Screenshot saved: test-preview-result.png');
  
  // Check iframe content
  const iframe = page.locator('[data-testid="live-preview-iframe"]');
  if (await iframe.isVisible()) {
    const frame = iframe.contentFrame ? await iframe.contentFrame() : null;
    if (frame) {
      const bodyText = await frame.locator('body').innerText().catch(() => 'COULD NOT READ');
      console.log('   Preview body text (first 300 chars):', bodyText.substring(0, 300));
    }
  }
  
  await browser.close();
  console.log('\nDone!');
})();
