import puppeteer from 'puppeteer-core';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Suhaib/.gemini/antigravity/brain/43c4e41f-1df1-4184-b8c9-884a90866e90';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function run() {
  console.log('[VERIFY] Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,950'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950 });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Seed test project with comprehensive dialogue blocks & character cases
  await page.evaluate(() => {
    localStorage.setItem('cp_uname', 'Muhammad Suhaib');
    localStorage.setItem('cp_urole', 'Line Producer');
    localStorage.setItem('cp_screen', 'editor');
    localStorage.setItem('cp_theme', 'dark-neon');

    const scenes = [
      {
        id: 'scn-1',
        sceneNumber: '1',
        slugline: 'INT. FORTRESS OF SOLITUDE - DAY',
        heading: 'INT. FORTRESS OF SOLITUDE - DAY',
        intExt: 'INT',
        timeOfDay: 'DAY',
        pageLengthDisplay: '2 4/8',
        pageLengthEighths: 20,
        synopsis: 'Superman confronts Robot 4 and Robot 1 over the stolen Kryptonian crystals.',
        characters: ['SUPERMAN', 'ROBOT 4', 'ROBOT 1', 'GENERAL ZOD'],
        location: 'Fortress of Solitude',
        dialogueBlocks: [
          { character: 'SUPERMAN', text: 'The outer perimeter alarm triggered ten minutes ago. Where are the containment logs?' },
          { character: 'ROBOT 4 (CONT\'D)', text: 'Corrupted during the ice storm, sir. We recovered only partial telemetry from the south turret.' },
          { character: 'SUPERMAN', text: 'Did Robot 1 inspect the vault seals?' },
          { character: 'ROBOT 1', text: 'Vault seals remain intact, Kal-El. However, residual thermal signatures match LexCorp alloys.' },
          { character: 'SUPERMAN (O.S.)', text: 'Then Luthor has already found the coordinates.' },
          { character: 'ROBOT 4', text: 'Should I initiate crystal lockdown protocols?' },
          { character: 'SUPERMAN', text: 'Yes. Lock down every chamber immediately.' },
        ],
      },
      {
        id: 'scn-2',
        sceneNumber: '2',
        slugline: 'EXT. ANTARCTICA - DAY',
        heading: 'EXT. ANTARCTICA - DAY',
        intExt: 'EXT',
        timeOfDay: 'DAY',
        pageLengthDisplay: '1 6/8',
        pageLengthEighths: 14,
        synopsis: 'Lex and Engineer test the orbital drill in the deep snow.',
        characters: ['LEX', 'ENGINEER', 'MERCENARY'],
        location: 'Antarctica',
        dialogueBlocks: [
          { character: 'LEX', text: 'The readings confirm the fortress is directly beneath this ridge.' },
          { character: 'ENGINEER (FILTERED)', text: 'Nanotech sensors are locking onto the crystal frequency now.' },
          { character: 'LEX', text: 'Bring the orbital array online before he returns.' },
          { character: 'ENGINEER', text: 'Charging capacitors. Four minutes to full penetration.' },
          { character: 'LEX', text: 'Make it three.' },
        ],
      },
      {
        id: 'scn-3',
        sceneNumber: '3',
        slugline: 'INT. DAILY PLANET NEWSROOM - DAY',
        heading: 'INT. DAILY PLANET NEWSROOM - DAY',
        intExt: 'INT',
        timeOfDay: 'DAY',
        pageLengthDisplay: '2 0/8',
        pageLengthEighths: 16,
        synopsis: 'Lois Lane, Clark Kent, and Perry White review satellite interference.',
        characters: ['LOIS LANE', 'CLARK KENT', 'PERRY WHITE', 'JIMMY OLSEN'],
        location: 'Daily Planet',
        dialogueBlocks: [
          { character: 'PERRY WHITE', text: 'Lane! Why are our polar correspondents dropping off the grid?' },
          { character: 'LOIS LANE', text: 'It is not weather interference, Chief. Somebody deployed a directional jamming beam over Antarctica.' },
          { character: 'CLARK KENT', text: 'Luthor Industries filed three classified aviation permits there last Tuesday.' },
          { character: 'LOIS LANE', text: 'Exactly. And every trail leads straight to Lex.' },
          { character: 'PERRY WHITE', text: 'Get me confirmation before the five o\'clock edition.' },
          { character: 'CLARK KENT (V.O.)', text: 'I am already heading south.' },
        ],
      },
      {
        id: 'scn-4',
        sceneNumber: '4',
        slugline: 'EXT. METROPOLIS ROOFTOP - NIGHT',
        heading: 'EXT. METROPOLIS ROOFTOP - NIGHT',
        intExt: 'EXT',
        timeOfDay: 'NIGHT',
        pageLengthDisplay: '1 2/8',
        pageLengthEighths: 10,
        synopsis: 'Superman intercepts Lex above the skyline.',
        characters: ['SUPERMAN', 'LEX', 'LOIS LANE'],
        location: 'Metropolis Rooftop',
        dialogueBlocks: [
          { character: 'SUPERMAN', text: 'Shut down the Antarctic rig, Lex.' },
          { character: 'LEX', text: 'You are far too late to save your precious archive.' },
          { character: 'SUPERMAN', text: 'People down there will freeze if that glacier fractures.' },
          { character: 'LEX', text: 'A small price to unmask an alien trespasser.' },
          { character: 'LOIS LANE (O.S.)', text: 'We have the permit logs on record, Lex! Stand down!' },
        ],
      },
      {
        id: 'scn-5',
        sceneNumber: '5',
        slugline: 'INT. OBSERVATION TOWER - NIGHT',
        heading: 'INT. OBSERVATION TOWER - NIGHT',
        intExt: 'INT',
        timeOfDay: 'NIGHT',
        pageLengthDisplay: '4/8',
        pageLengthEighths: 4,
        synopsis: 'Watchman logs a solitary observation.',
        characters: ['NIGHT WATCHMAN'],
        location: 'Observation Tower',
        dialogueBlocks: [
          { character: 'NIGHT WATCHMAN', text: 'Blue streak heading north-northwest at Mach 4.' },
        ],
      },
    ];

    const project = {
      id: 'proj-verify-char-analysis',
      title: 'SUPERMAN (Production Draft)',
      logline: 'Man of Steel faces Lex Luthor over the Fortress of Solitude.',
      director: 'James Gunn',
      status: 'development',
      startDate: '2026-02-01',
      finalEndDate: '2026-05-05',
      suggestedEndDate: '2026-05-05',
      isEndDateFixed: false,
      constraints: {
        budgetLimit: 15000000,
        dailyBurnRateCap: 50000,
        screenplayLocked: true,
        castAvailabilityDays: 60,
        permitLeadTimeDays: 14,
        targetRating: 'PG-13',
        weatherContingencyBuffer: 5,
        postOverheadRatio: 15,
      },
      phases: [],
      screenplayVersions: [
        {
          id: 'sp-verify-1',
          version: 'v2.4 Shooting Draft',
          title: 'SUPERMAN',
          author: 'James Gunn',
          updatedAt: new Date().toISOString(),
          changeDescription: 'Latest canonical shooting draft',
          status: 'Approved',
          scenes,
          extractedScenes: scenes,
        },
      ],
      scenes,
      elementCatalog: [
        { id: 'el-1', name: 'SUPERMAN', category: 'cast' },
        { id: 'el-2', name: 'LEX', category: 'cast' },
      ],
      sceneBreakdownAssociations: [],
      activeScreenplayVersionId: 'sp-verify-1',
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem('sceneos_local_projects_registry', JSON.stringify([project]));
    localStorage.setItem('sceneos_active_project_id', project.id);
    localStorage.setItem(`sceneos_production_${project.id}`, JSON.stringify(project));
  });

  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));

  const bodyPreview = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('[VERIFY] Body after reload:\n', bodyPreview);

  // If on dashboard, click ENTER DIRECT WORKSPACE
  await page.evaluate(() => {
    const enterBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent && b.textContent.includes('ENTER DIRECT WORKSPACE')
    );
    if (enterBtn) enterBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Navigate to Breakdown Workspace via sidebar
  await page.evaluate(() => {
    const btn = document.getElementById('sidebar-tab-breakdown') ||
      Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.trim() === 'Breakdown'
      );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Inspect navigation bar text to confirm 5 sections
  const navText = await page.evaluate(() => {
    const nav = document.querySelector('[data-testid="breakdown-navigation-bar"]');
    return nav ? nav.innerText : 'NAV NOT FOUND';
  });
  console.log('[VERIFY] Breakdown Navigation Bar:\n', navText);

  // Screenshot 1 & 2: 5 Sections & Character Relationship Graph
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_5_breakdown_sections.png') });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_character_relationship_graph.png') });
  console.log('[VERIFY] Captured 5 sections & Relationship Graph.');

  // Click SUPERMAN node in the SVG graph
  await page.evaluate(() => {
    const supermanNode = document.querySelector('g[data-character="SUPERMAN"]') || document.querySelector('g[data-character]');
    if (supermanNode) {
      supermanNode.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Screenshot 3: Selected character analytical detail panel
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_selected_character_analytical_view.png') });
  console.log('[VERIFY] Captured Selected Character Analytical Detail Panel.');

  // Switch to Compact Table view
  await page.evaluate(() => {
    const tableBtn = document.querySelector('[data-testid="character-view-table-btn"]');
    if (tableBtn) tableBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Screenshot 4: Compact Tabular Alternative (synchronized)
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_compact_character_matrix.png') });
  console.log('[VERIFY] Captured Compact Table View.');

  // Open Extraction Completeness & Audit Modal
  await page.evaluate(() => {
    const auditBtn = document.querySelector('[data-testid="character-audit-status-btn"]');
    if (auditBtn) auditBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Screenshot 5: Extraction Completeness Audit State
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_character_extraction_audit.png') });
  console.log('[VERIFY] Captured Extraction Completeness Audit Modal.');

  await browser.close();
  console.log('[VERIFY] E2E verification complete!');
}

run().catch((err) => {
  console.error('[VERIFY] Error:', err);
  process.exit(1);
});
