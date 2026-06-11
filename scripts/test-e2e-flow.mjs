import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warn') {
      console.log(`BROWSER ${type.toUpperCase()}:`, msg.text());
    }
  });
  
  console.log('1. Loading page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  // Take initial screenshot
  await page.screenshot({ path: 'test-e2e-1-initial.png' });
  console.log('   Screenshot: test-e2e-1-initial.png');
  
  // 2. Click "Detect Local Key File" on the gate
  console.log('2. Clicking gate-connect-fallback-btn...');
  const fallbackBtn = page.locator('[data-testid="gate-connect-fallback-btn"]');
  if (await fallbackBtn.isVisible()) {
    await fallbackBtn.click();
    await page.waitForTimeout(2000);
    console.log('   Clicked fallback wallet button');
  } else {
    console.log('   WARNING: gate-connect-fallback-btn not visible! Taking screenshot...');
    await page.screenshot({ path: 'test-e2e-2-no-gate.png' });
  }
  
  await page.screenshot({ path: 'test-e2e-2-after-wallet.png' });
  console.log('   Screenshot: test-e2e-2-after-wallet.png');
  
  // 3. Check if chat input is now visible
  console.log('3. Looking for chat-input...');
  const chatInput = page.locator('[data-testid="chat-input"]');
  const isInputVisible = await chatInput.isVisible().catch(() => false);
  console.log('   chat-input visible:', isInputVisible);
  
  if (!isInputVisible) {
    // Maybe wallet gate still showing?
    const gateTitle = page.locator('[data-testid="chat-gate-title"]');
    const gateVisible = await gateTitle.isVisible().catch(() => false);
    console.log('   chat-gate-title visible:', gateVisible);
    if (gateVisible) {
      console.log('   ❌ PROBLEM: Wallet connection failed — gate still showing');
    }
    
    // Check for any input anywhere in the chat panel
    const allInputs = await page.locator('textarea, input[type="text"]').all();
    console.log('   Total text inputs on page:', allInputs.length);
    for (const inp of allInputs) {
      const placeholder = await inp.getAttribute('placeholder');
      const testId = await inp.getAttribute('data-testid');
      console.log(`     - placeholder="${placeholder}" data-testid="${testId}"`);
    }
  }
  
  // 4. Try to send a message
  if (isInputVisible) {
    console.log('4. Sending chat message...');
    await chatInput.fill('Create a simple Hello World component');
    
    // Find and click send button
    const sendBtn = page.locator('[data-testid="chat-send-btn"]');
    if (await sendBtn.isVisible()) {
      await sendBtn.click();
      console.log('   Message sent!');
    } else {
      // Try pressing Enter
      await chatInput.press('Enter');
      console.log('   Pressed Enter to send');
    }
    
    // Wait for response
    console.log('   Waiting for AI response...');
    await page.waitForTimeout(15000); // Wait 15s for AI response
    
    await page.screenshot({ path: 'test-e2e-3-after-chat.png' });
    console.log('   Screenshot: test-e2e-3-after-chat.png');
    
    // Check if any action cards appeared
    const actionCards = await page.locator('[data-testid="action-card"], button:has-text("Apply")').all();
    console.log('   Action cards/Apply buttons found:', actionCards.length);
    
    // Check assistant messages
    const assistantMsgs = await page.locator('[data-testid="chat-message-assistant"]').all();
    console.log('   Assistant messages:', assistantMsgs.length);
    if (assistantMsgs.length > 0) {
      const lastMsg = assistantMsgs[assistantMsgs.length - 1];
      const text = await lastMsg.innerText();
      console.log('   Last assistant message (first 200 chars):', text.substring(0, 200));
    }
  }
  
  await browser.close();
  console.log('\nDone!');
})();
