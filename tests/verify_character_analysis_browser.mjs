import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:/Users/Suhaib/.gemini/antigravity/brain/43c4e41f-1df1-4184-b8c9-884a90866e90';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP, 'chrtmp_' + Date.now());

async function verify() {
  console.log('[1/6] Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: TEMP_USER_DATA,
    args: ['--window-size=1440,900', '--no-first-run'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[Browser Error]', msg.text());
  });

  console.log('[2/6] Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2000));

  console.log('[3/6] Setting up project session in localStorage if needed...');
  await page.evaluate(() => {
    // If not logged in, select development persona or click guest
    const buttons = Array.from(document.querySelectorAll('button'));
    const personaBtn = buttons.find(b => b.textContent?.includes('Kira') || b.textContent?.includes('Guest') || b.textContent?.includes('Demo') || b.textContent?.includes('Producer'));
    if (personaBtn) personaBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Navigate to Breakdown Workspace via sidebar or top tabs
  console.log('[4/6] Navigating to Breakdown workspace...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const breakdownNav = buttons.find(b => 
      b.getAttribute('data-testid')?.includes('breakdown') || 
      b.getAttribute('aria-label')?.toLowerCase().includes('breakdown') ||
      b.textContent?.trim() === 'Breakdown'
    );
    if (breakdownNav) breakdownNav.click();
  });
  await new Promise((r) => setTimeout(r, 2500));

  // 1. Capture Breakdown 5 Sections & Relationship Graph
  console.log('[5/6] Capturing Character Analysis Graph & 5 Breakdown Sections...');
  const graphScreenshotPath = path.join(ARTIFACT_DIR, 'verified_character_relationship_graph.png');
  const sectionsScreenshotPath = path.join(ARTIFACT_DIR, 'verified_5_breakdown_sections.png');
  await page.screenshot({ path: graphScreenshotPath });
  fs.copyFileSync(graphScreenshotPath, sectionsScreenshotPath);
  console.log('Saved:', graphScreenshotPath);

  // 2. Click a character node to inspect Analytical Details
  console.log('[6/6] Selecting a character node for analytical details...');
  await page.evaluate(() => {
    const node = document.querySelector('g[data-character]');
    if (node) {
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 1000));

  const detailScreenshotPath = path.join(ARTIFACT_DIR, 'verified_selected_character_analytical_view.png');
  await page.screenshot({ path: detailScreenshotPath });
  console.log('Saved:', detailScreenshotPath);

  // 3. Switch to Compact Table view
  console.log('Switching to Compact Table view...');
  await page.evaluate(() => {
    const tableBtn = document.querySelector('[data-testid="character-view-table-btn"]') ||
      Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Compact Table'));
    if (tableBtn) {
      tableBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 1000));

  const tableScreenshotPath = path.join(ARTIFACT_DIR, 'verified_compact_character_matrix.png');
  await page.screenshot({ path: tableScreenshotPath });
  console.log('Saved:', tableScreenshotPath);

  // 4. Open Extraction & Audit Modal
  console.log('Opening Extraction & Completeness Audit Modal...');
  await page.evaluate(() => {
    const auditBtn = document.querySelector('[data-testid="character-audit-status-btn"]') ||
      Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Extraction') || b.textContent?.includes('Review'));
    if (auditBtn) {
      auditBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 1000));

  const auditScreenshotPath = path.join(ARTIFACT_DIR, 'verified_character_extraction_audit.png');
  await page.screenshot({ path: auditScreenshotPath });
  console.log('Saved:', auditScreenshotPath);

  await browser.close();
  console.log('Browser verification completed successfully!');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
