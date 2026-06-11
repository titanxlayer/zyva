import { chromium } from 'playwright';

// Verify per-agent streaming lights up the Swarm panel in real time.
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let sawStream = false;
  page.on('response', (res) => { if (res.url().includes('/api/agent/stream')) sawStream = true; });

  console.log('1. Connect wallet...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.locator('[data-testid="gate-connect-fallback-btn"]').click();
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });

  console.log('2. Enable Multi-Agent + send task...');
  await page.locator('[data-testid="multi-agent-toggle"]').click();
  await page.locator('[data-testid="chat-input"]').fill('Build a pricing page and a contact form API');
  await page.locator('[data-testid="chat-send-btn"]').click();

  console.log('3. Switch to Swarm panel and watch agents...');
  await page.locator('[data-testid="right-panel-swarm-tab"]').click();

  // Poll for live "working" then "completed" states over the run.
  const seen = new Set();
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    const working = await page.locator('text=Enclave Active').count();
    const done = await page.locator('text=Completed').count();
    if (working > 0) seen.add('working');
    if (done > 0) seen.add('done');
    // Stop once the run has clearly progressed and a final message exists.
    const assistantMsgs = await page.locator('[data-testid="chat-message-assistant"]').count();
    if (seen.has('done') && assistantMsgs > 0) break;
    await page.waitForTimeout(1500);
  }

  // Activity feed entries (architect/frontend/etc.)
  const feedText = await page.locator('text=Planned').count().catch(() => 0);

  await page.screenshot({ path: 'test-swarm-stream.png' });

  console.log('\n=== RESULTS ===');
  console.log('stream endpoint hit:', sawStream);
  console.log('saw agents working (live):', seen.has('working'));
  console.log('saw agents completed:', seen.has('done'));
  console.log('planner activity feed present:', feedText > 0);

  const ok = sawStream && seen.has('done');
  console.log(ok ? '\n✅ SWARM STREAMING OK' : '\n❌ FAILED');
  await browser.close();
})();
