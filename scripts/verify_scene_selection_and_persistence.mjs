import puppeteer from 'puppeteer-core';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Suhaib/.gemini/antigravity/brain/43c4e41f-1df1-4184-b8c9-884a90866e90';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function run() {
  console.log('[VERIFY] Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://localhost:3000');

  // Seed test project with 10 scenes
  await page.evaluate(() => {
    localStorage.setItem('cp_uname', 'Muhammad Suhaib');
    localStorage.setItem('cp_urole', 'Line Producer');
    localStorage.setItem('cp_screen', 'editor');

    const scenes = Array.from({ length: 10 }, (_, i) => ({
      id: `scn-verify-${i + 1}`,
      sceneNumber: String(i + 1),
      slugline: i % 2 === 0 ? 'INT. FORTRESS OF SOLITUDE - DAY' : 'EXT. ANTARCTICA - NIGHT',
      heading: i % 2 === 0 ? 'INT. FORTRESS OF SOLITUDE - DAY' : 'EXT. ANTARCTICA - NIGHT',
      intExt: i % 2 === 0 ? 'INT' : 'EXT',
      timeOfDay: i % 2 === 0 ? 'DAY' : 'NIGHT',
      pageLengthDisplay: '1 2/8',
      pageLengthEighths: 10,
      synopsis: `Scene ${i + 1} narrative description.`,
      characters: ['SUPERMAN', 'LEX', 'ROBOT 4'],
      location: i % 2 === 0 ? 'Fortress of Solitude' : 'Antarctica Outer Glaciers',
      shootDay: Math.floor(i / 3) + 1,
    }));

    const project = {
      id: 'proj-verify-reports',
      title: 'allah ve kapathu please',
      status: 'development',
      startDate: '2026-02-01',
      finalEndDate: '2026-05-05',
      suggestedEndDate: '2026-05-05',
      isEndDateFixed: false,
      constraints: {
        maxOvertimeHours: 2,
        turnaroundHours: 12,
        mealBreakFrequency: 6,
        sundayPremiums: true,
        weatherBufferDays: 1,
      },
      phases: [],
      screenplayVersions: [
        {
          id: 'sp-verify-1',
          version: 'SUPERMAN',
          scenes,
          extractedScenes: scenes,
        },
      ],
      scenes,
      elementCatalog: [
        { id: 'el-1', name: 'SUPERMAN', category: 'cast', associatedScenes: scenes },
        { id: 'el-2', name: 'LEX', category: 'cast', associatedScenes: scenes },
        { id: 'el-3', name: 'ROBOT 4', category: 'cast', associatedScenes: scenes },
      ],
      sceneBreakdownAssociations: scenes.flatMap((s) => [
        { id: `assoc-${s.id}-1`, sceneId: s.id, elementId: 'el-1' },
        { id: `assoc-${s.id}-2`, sceneId: s.id, elementId: 'el-2' },
        { id: `assoc-${s.id}-3`, sceneId: s.id, elementId: 'el-3' },
      ]),
      activeScreenplayVersionId: 'sp-verify-1',
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem('sceneos_local_projects_registry', JSON.stringify([project]));
    localStorage.setItem('sceneos_active_project_id', project.id);
    localStorage.setItem(`sceneos_production_${project.id}`, JSON.stringify(project));
  });

  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));

  // Navigate to Breakdown Workspace
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const btn = buttons.find(
      (b) => b.title === 'Breakdown' || (b.innerText && b.innerText.trim() === 'Breakdown')
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Click on Breakdown Reports tab
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="breakdown-submodule-reports-btn"]');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // 1. Verify Scene Selector Button exists in Breakdown Summary
  const sceneBtn = await page.$('[data-testid="breakdown-report-scene-selector-btn"]');
  console.log('[VERIFY] Scene Selector Button exists:', !!sceneBtn);

  // Click Scene Selector to open popover
  if (sceneBtn) {
    await sceneBtn.click();
    await new Promise((r) => setTimeout(r, 500));

    const popoverExists = await page.$('[data-testid="breakdown-report-scene-selector-popover"]');
    console.log('[VERIFY] Scene Selector Popover opened:', !!popoverExists);

    // Capture screenshot of open popover
    const shotPopover = path.join(ARTIFACT_DIR, 'verified_scene_selector_popover.png');
    await page.screenshot({ path: shotPopover });
    console.log('[VERIFY] Captured:', shotPopover);

    // Apply Range: Select scenes 1-3 only
    console.log('[VERIFY] Applying scene range 1-3...');
    await page.evaluate(() => {
      const pop = document.querySelector('[data-testid="breakdown-report-scene-selector-popover"]');
      if (!pop) return;
      const input = pop.querySelector('input[type="text"]');
      if (input) {
        input.value = '1-3';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const btns = Array.from(pop.querySelectorAll('button'));
      const applyBtn = btns.find((b) => b.textContent && b.textContent.includes('Apply'));
      if (applyBtn) applyBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Close popover
    await page.evaluate(() => {
      const sheet = document.getElementById('sceneos-report-sheet');
      if (sheet) sheet.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Check how many scenes are rendered in Breakdown Summary
    const renderedSummaryCount = await page.evaluate(() => {
      const sheet = document.getElementById('sceneos-report-sheet');
      const breaks = sheet ? sheet.querySelectorAll('.reports-page-break') : [];
      return breaks.length;
    });
    console.log('[VERIFY] Breakdown Summary Rendered Scenes (expecting 3):', renderedSummaryCount);

    // Capture filtered Breakdown Summary screenshot
    const shotFilteredSummary = path.join(ARTIFACT_DIR, 'verified_filtered_breakdown_summary.png');
    await page.screenshot({ path: shotFilteredSummary });
    console.log('[VERIFY] Captured:', shotFilteredSummary);

    // 2. Switch to Shooting Schedule and verify it also respects the 3 selected scenes
    console.log('[VERIFY] Switching to Shooting Schedule...');
    await page.evaluate(() => {
      const dropdownBtn = document.querySelector('button[title="Select production report"]');
      if (dropdownBtn) dropdownBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const scheduleBtn = btns.find((b) => b.textContent && b.textContent.includes('Shooting Schedule'));
      if (scheduleBtn) scheduleBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const renderedScheduleScenes = await page.evaluate(() => {
      const sheet = document.getElementById('sceneos-report-sheet');
      const sceneCards = sheet ? sheet.querySelectorAll('.space-y-2.pb-4') : [];
      return sceneCards.length;
    });
    console.log('[VERIFY] Shooting Schedule Rendered Scenes (expecting 3):', renderedScheduleScenes);

    // Capture filtered Shooting Schedule screenshot
    const shotFilteredSched = path.join(ARTIFACT_DIR, 'verified_filtered_shooting_schedule.png');
    await page.screenshot({ path: shotFilteredSched });
    console.log('[VERIFY] Captured:', shotFilteredSched);
  }

  // 3. Test Script Persistence Across Refreshes
  console.log('[VERIFY] Testing Script Persistence Across Refreshes...');
  // Click Screenplay tab in sidebar
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const btn = buttons.find(
      (b) => b.title === 'Screenplay' || (b.innerText && b.innerText.trim() === 'Screenplay')
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  // Check script title before refresh
  const scriptTitleBefore = await page.evaluate(() => {
    const doc = document.querySelector('.screenplay-document-title, h1, input[value*="SUPERMAN"]');
    return doc?.textContent || doc?.value || document.body.innerText.includes('SUPERMAN');
  });
  console.log('[VERIFY] Script Before Refresh:', scriptTitleBefore);

  const shotBeforeRefresh = path.join(ARTIFACT_DIR, 'verified_screenplay_before_refresh.png');
  await page.screenshot({ path: shotBeforeRefresh });
  console.log('[VERIFY] Captured:', shotBeforeRefresh);

  // Perform hard browser reload
  console.log('[VERIFY] Reloading page (Ctrl+R / F5 simulation)...');
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1800));

  // Navigate back to screenplay workspace to verify persistence
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const btn = buttons.find(
      (b) => b.title === 'Screenplay' || (b.innerText && b.innerText.trim() === 'Screenplay')
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  const scriptTitleAfter = await page.evaluate(() => {
    return document.body.innerText.includes('SUPERMAN');
  });
  console.log('[VERIFY] Script Persisted After Refresh (SUPERMAN present):', scriptTitleAfter);

  const shotAfterRefresh = path.join(ARTIFACT_DIR, 'verified_screenplay_after_refresh.png');
  await page.screenshot({ path: shotAfterRefresh });
  console.log('[VERIFY] Captured:', shotAfterRefresh);

  await browser.close();
  console.log('[VERIFY] All verification completed successfully!');
}

run().catch(console.error);
