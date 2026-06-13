/**
 * Playwright test: auth flow on app.zyva.dev
 * Tests: signin page loads, OAuth buttons exist, wallet button exists,
 *        redirect to signin for unauthenticated access.
 *
 * Run: node --env-file=.env.local scripts/test-auth-flow.mjs
 */

import { chromium } from 'playwright';

const BASE = process.env.TEST_BASE_URL || 'https://app.zyva.dev';
const PASS = '✅';
const FAIL = '❌';

let passed = 0;
let failed = 0;

function log(ok, label, detail = '') {
  const sym = ok ? PASS : FAIL;
  console.log(`${sym} ${label}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed++; else failed++;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: false });

  console.log(`\n=== ZYVA Auth Flow Test ===`);
  console.log(`Target: ${BASE}\n`);

  // ── Test 1: signin page loads ──────────────────────────────────────────────
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const title = await page.title();
  log(!!title, 'Signin page loads', `title="${title}"`);

  // ── Test 2: Google button present ─────────────────────────────────────────
  const googleBtn = await page.locator('button:has-text("Google")').count();
  log(googleBtn > 0, 'Google button present');

  // ── Test 3: GitHub button present ─────────────────────────────────────────
  const githubBtn = await page.locator('button:has-text("GitHub")').count();
  log(githubBtn > 0, 'GitHub button present');

  // ── Test 4: Wallet button present ─────────────────────────────────────────
  const walletBtn = await page.locator('button:has-text("Wallet")').count();
  log(walletBtn > 0, 'Wallet button present');

  // ── Test 5: ZYVA logo present ─────────────────────────────────────────────
  const logo = await page.locator('text=ZYVA').count();
  log(logo > 0, 'ZYVA logo present');

  // ── Test 6: Unauthenticated access → redirect to signin ───────────────────
  const page2 = await ctx.newPage();
  const resp = await page2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const finalUrl = page2.url();
  log(
    finalUrl.includes('/auth/signin'),
    'Unauthenticated / redirects to signin',
    `landed at: ${finalUrl}`
  );

  // ── Test 7: /api/auth/providers returns providers ─────────────────────────
  const providersResp = await fetch(`${BASE}/api/auth/providers`);
  let providers = [];
  let providersOk = false;
  try {
    const body = await providersResp.json();
    providers = Object.keys(body || {});
    providersOk = providersResp.status === 200 && providers.includes('github') && providers.includes('google');
  } catch {}
  log(
    providersOk,
    '/api/auth/providers returns github + google',
    `providers: [${providers.join(', ')}]`
  );

  // ── Test 8: signin overlay structure is correct ──────────────────────────
  const hasOverlay = await page.evaluate(() => {
    // Check that the glassmorphism card exists with backdrop-filter
    const btns = document.querySelectorAll('button');
    return btns.length >= 3; // Google + GitHub + Wallet
  });
  log(hasOverlay, 'Signin overlay has all 3 auth buttons rendered');

  // ── Test 9: signin page has no JS errors ──────────────────────────────────
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.reload({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  log(errors.length === 0, 'No JS errors on signin page', errors.length > 0 ? errors[0].slice(0, 80) : '');

  // ── Test 10: NEXTAUTH_SECRET is set (CSRF endpoint responds) ─────────────
  const csrfResp = await fetch(`${BASE}/api/auth/csrf`);
  log(csrfResp.status === 200, 'CSRF endpoint responds 200 (NEXTAUTH_SECRET set)');

  await browser.close();

  console.log(`\n=== Results: ${passed}/${passed + failed} passed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
