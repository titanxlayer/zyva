import { chromium } from 'playwright';

// End-to-end: connect wallet -> ask GLM (Cerebras) in English to build a landing page
// -> wait for auto-apply -> open Live Preview -> verify the iframe actually rendered.
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const apiCalls = [];
  page.on('response', async (res) => {
    if (res.url().includes('/api/ai/chat')) {
      try {
        const json = await res.json();
        apiCalls.push({ source: json.source, hasReply: !!json.reply, replyLen: (json.reply || '').length });
      } catch {}
    }
  });
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('BROWSER ERROR:', m.text());
  });

  console.log('1. Loading IDE...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  console.log('2. Connecting wallet (local key)...');
  await page.locator('[data-testid="gate-connect-fallback-btn"]').click();
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });

  // Confirm model selector is on a free GLM model
  const model = await page.locator('[data-testid="agent-model-select"]').inputValue();
  console.log('   Selected model:', model);

  console.log('3. Sending English coding prompt...');
  const chatInput = page.locator('[data-testid="chat-input"]');
  await chatInput.fill('Create an online store landing page with a hero section and product cards');
  await page.locator('[data-testid="chat-send-btn"]').click().catch(() => chatInput.press('Enter'));

  console.log('4. Waiting for AI response + auto-apply...');
  // Wait until the app has a project path + App.tsx applied (preview toggle appears)
  await page.waitForSelector('[data-testid="preview-tab"]', { timeout: 90000 });
  console.log('   Project active, preview toggle visible.');

  // Give auto-apply a moment to finish writing files into the store
  await page.waitForTimeout(4000);

  console.log('5. Opening Live Preview...');
  await page.locator('[data-testid="preview-tab"]').click();
  await page.waitForSelector('[data-testid="live-preview-iframe"]', { timeout: 10000 });
  await page.waitForTimeout(6000); // allow Babel transpile + CDN React render inside iframe

  // Inspect what actually rendered inside the sandboxed iframe
  const frame = page.frames().find((f) => f.name() === '' && f.url().startsWith('about:srcdoc')) ||
    page.frameLocator('[data-testid="live-preview-iframe"]');

  let rootText = '';
  let hasError = false;
  try {
    const fl = page.frameLocator('[data-testid="live-preview-iframe"]');
    rootText = await fl.locator('#root').innerText({ timeout: 5000 }).catch(() => '');
    hasError = (await fl.locator('.preview-error').count()) > 0;
  } catch (e) {
    console.log('   Could not read iframe content:', e.message);
  }

  await page.screenshot({ path: 'test-preview-full.png', fullPage: false });
  console.log('   Screenshot saved: test-preview-full.png');

  console.log('\n=== RESULTS ===');
  console.log('AI chat API calls:', JSON.stringify(apiCalls, null, 2));
  console.log('Preview rendered error block:', hasError);
  console.log('Preview #root text (first 300 chars):', JSON.stringify(rootText.slice(0, 300)));

  const ok = !hasError && rootText.trim().length > 0;
  console.log(ok ? '\n✅ PREVIEW RENDERED SUCCESSFULLY' : '\n❌ PREVIEW DID NOT RENDER PROPERLY');

  await browser.close();
})();
