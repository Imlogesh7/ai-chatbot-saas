/**
 * Playwright screenshot capture for ContextIQ demo slide
 * Captures: Login, Dashboard, ChatbotDetail (Documents, Chat, Embed tabs)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://frontend-ten-hazel-61.vercel.app';
const OUT_DIR  = path.join(__dirname, 'screenshots');

const TEST_EMAIL    = 'demo_screenshot@contextiq.ai';
const TEST_PASSWORD = 'DemoPass@2026';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 860 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // ── 1. Signup (or ignore if account already exists) ──────────────────────
  console.log('→ Signing up test account...');
  await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
  await sleep(1200);

  try {
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', TEST_PASSWORD);
    // firstName / lastName if present
    const fn = page.locator('input[name="firstName"], input[placeholder*="First"]').first();
    if (await fn.count()) await fn.fill('Demo');
    const ln = page.locator('input[name="lastName"], input[placeholder*="Last"]').first();
    if (await ln.count()) await ln.fill('User');
    await page.click('button[type="submit"]');
    await sleep(2500);
  } catch (e) {
    console.log('  signup form error, trying login directly');
  }

  // ── 2. Login ──────────────────────────────────────────────────────────────
  console.log('→ Logging in...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await sleep(1000);
  await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
  await page.fill('input[type="password"], input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});
  await sleep(2000);

  // ── 3. Dashboard screenshot ───────────────────────────────────────────────
  console.log('→ Dashboard screenshot...');
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await sleep(2000);
  await page.screenshot({ path: path.join(OUT_DIR, '1_dashboard.png'), fullPage: false });
  console.log('  ✓ 1_dashboard.png');

  // ── 4. Create a demo chatbot if none ─────────────────────────────────────
  console.log('→ Navigating to chatbots list...');
  await page.goto(`${BASE_URL}/chatbots`, { waitUntil: 'networkidle' });
  await sleep(1800);

  // Try to create a chatbot via the "New Chatbot" / "Create" button
  const createBtn = page.locator('button').filter({ hasText: /create|new chatbot/i }).first();
  if (await createBtn.count()) {
    await createBtn.click();
    await sleep(800);
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (await nameInput.count()) {
      await nameInput.fill('Customer Support Bot');
      const descInput = page.locator('textarea, input[name="description"]').first();
      if (await descInput.count()) await descInput.fill('AI assistant for ContextIQ demo');
      const submitBtn = page.locator('button[type="submit"], button').filter({ hasText: /create|save|submit/i }).last();
      await submitBtn.click();
      await sleep(2000);
    }
  }

  // ── 5. Open first chatbot detail ─────────────────────────────────────────
  console.log('→ Opening chatbot detail...');
  await page.goto(`${BASE_URL}/chatbots`, { waitUntil: 'networkidle' });
  await sleep(1500);

  // Click first chatbot card / link
  const chatbotLink = page.locator('a[href*="/chatbots/"], [data-chatbot-id]').first();
  const chatbotCard = page.locator('.card, [class*="card"]').first();
  if (await chatbotLink.count()) {
    await chatbotLink.click();
  } else {
    // Try clicking a card that navigates
    const cards = page.locator('a').filter({ hasText: /bot|support|assistant/i });
    if (await cards.count()) await cards.first().click();
  }
  await sleep(2000);

  // ── 6. Documents tab screenshot ──────────────────────────────────────────
  console.log('→ Documents tab screenshot...');
  const docsTab = page.locator('[role="tab"], button').filter({ hasText: /document/i }).first();
  if (await docsTab.count()) await docsTab.click();
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT_DIR, '2_documents.png'), fullPage: false });
  console.log('  ✓ 2_documents.png');

  // ── 7. Chat tab screenshot ───────────────────────────────────────────────
  console.log('→ Chat tab screenshot...');
  const chatTab = page.locator('[role="tab"], button').filter({ hasText: /^chat$/i }).first();
  if (await chatTab.count()) await chatTab.click();
  await sleep(1000);
  // Type a sample message to populate the chat
  const chatInput = page.locator('input[placeholder*="message" i], input[placeholder*="ask" i], textarea').first();
  if (await chatInput.count()) {
    await chatInput.fill('What can you help me with?');
    await page.keyboard.press('Enter');
    await sleep(4000); // wait for AI response
  }
  await page.screenshot({ path: path.join(OUT_DIR, '3_chat.png'), fullPage: false });
  console.log('  ✓ 3_chat.png');

  // ── 8. Embed tab screenshot ──────────────────────────────────────────────
  console.log('→ Embed tab screenshot...');
  const embedTab = page.locator('[role="tab"], button').filter({ hasText: /embed/i }).first();
  if (await embedTab.count()) await embedTab.click();
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT_DIR, '4_embed.png'), fullPage: false });
  console.log('  ✓ 4_embed.png');

  await browser.close();
  console.log('\n✅ All screenshots saved to:', OUT_DIR);
  const files = fs.readdirSync(OUT_DIR);
  files.forEach(f => console.log(' ', f));
})();
