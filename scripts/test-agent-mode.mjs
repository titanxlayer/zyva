import { chromium } from 'playwright';

// Verify the UI Multi-Agent toggle drives the real graph and the preview renders.
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const calls = [];
  page.on('response', async (res) => {
    if (res.url().includes('/api/ai/chat')) {
      try { const j = await res.json(); calls.push({ source: j.source, agentsRun: j.agentsRun, plan: (j.plan || []).length }); } catch {}
    }
  });

  console.log('1. Load + connect wallet...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.locator('[data-testid="gate-connect-fallback-btn"]').click();
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });

  console.log('2. Enable Multi-Agent mode...');
  await page.locator('[data-testid="multi-agent-toggle"]').click();
  const label = await page.locator('[data-testid="multi-agent-toggle"]').innerText();
  console.log('   toggle:', label.trim());

  console.log('3. Send a multi-part coding task...');
  await page.locator('[data-testid="chat-input"]').fill('Create a landing page with a hero and a contact form');
  await page.locator('[data-testid="chat-send-btn"]').click();

  console.log('4. Wait for graph + auto-apply...');
  await page.waitForSelector('[data-testid="preview-tab"]', { timeout: 150000 });
  await page.waitForTimeout(4000);

  console.log('5. Open preview...');
  await page.locator('[data-testid="preview-tab"]').click();
  await page.waitForTimeout(6000);
  const fl = page.frameLocator('[data-testid="live-preview-iframe"]');
  const rootText = await fl.locator('#root').innerText({ timeout: 5000 }).catch(() => '');
  const hasError = (await fl.locator('.preview-error').count()) > 0;
  await page.screenshot({ path: 'test-agent-mode.png' });

  console.log('\n=== RESULTS ===');
  console.log('chat calls:', JSON.stringify(calls));
  console.log('preview error:', hasError);
  console.log('root text:', JSON.stringify(rootText.slice(0, 200)));
  const ok = !hasError && rootText.trim().length > 0 && calls.some(c => (c.source || '').includes('Multi-Agent'));
  console.log(ok ? '\n✅ MULTI-AGENT UI FLOW OK' : '\n❌ FAILED');
  await browser.close();
})();
