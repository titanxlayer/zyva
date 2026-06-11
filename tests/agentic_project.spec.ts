import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('ZYVA AI Agentic Project Creation Test', () => {
  test('should ask the AI to create a new project, apply actions manually, and verify project files exist', async ({ page }) => {
    // 1. Goto home page
    await page.goto('/');

    // 2. Go to Settings tab and disable Autonomous Mode
    await page.click('[data-testid="activity-settings"]');
    const autoCheckbox = page.locator('[data-testid="settings-autonomous-checkbox"]');
    await expect(autoCheckbox).toBeChecked();
    await autoCheckbox.uncheck();
    await expect(autoCheckbox).not.toBeChecked();

    // 3. Open Chat Tab on the right side panel
    await page.click('[data-testid="right-panel-chat-tab"]');

    // 4. Unlock chat using fallback wallet connection
    await page.click('[data-testid="gate-connect-fallback-btn"]');
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();

    // 5. Send a message to the AI asking it to make a new project
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('buat landing page toko online');
    await page.click('[data-testid="chat-send-btn"]');

    // 6. Wait for the agent to reply with project creation and file actions
    const createProjectBtn = page.locator('button:has-text("Buat Project")');
    await expect(createProjectBtn).toBeVisible({ timeout: 15000 });

    // 7. Click "Buat Project" to scaffold the project
    await createProjectBtn.click();

    // 8. Verify the workspace updates to show the new project (resilient to hyphenation differences)
    await expect(page.locator('text=workspace /').first()).toContainText('toko', { timeout: 10000 });

    // 9. Wait for the ZYVA_FILE action card to appear and click "Apply" to write the code file
    const applyFileBtn = page.locator('button:has-text("Apply")').first();
    await expect(applyFileBtn).toBeVisible({ timeout: 10000 });
    await applyFileBtn.click();

    // 10. Verify the file tree lists the created file (accept page.tsx or App.tsx)
    const fileLocator = page.locator('text=page.tsx').or(page.locator('text=App.tsx')).first();
    await expect(fileLocator).toBeVisible({ timeout: 10000 });

    // 11. Verify that either file exists on disk under parent directory (check both names and structures)
    const checkPaths = [
      'C:/Project Web Zyva/toko-online/src/app/page.tsx',
      'C:/Project Web Zyva/tokoonline/src/app/page.tsx',
      'C:/Project Web Zyva/toko-online/src/App.tsx',
      'C:/Project Web Zyva/tokoonline/src/App.tsx',
    ];
    const exists = checkPaths.some(p => fs.existsSync(path.resolve(p)));
    expect(exists).toBe(true);

    // Clean up created project folder
    try {
      fs.rmSync(path.resolve('C:/Project Web Zyva/toko-online'), { recursive: true, force: true });
      fs.rmSync(path.resolve('C:/Project Web Zyva/tokoonline'), { recursive: true, force: true });
    } catch (e) {
      console.warn('Cleanup failed:', e.message);
    }
  });
});
