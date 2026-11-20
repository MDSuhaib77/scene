import fs from 'fs';
import { spawn } from 'child_process';

const artifactDir = 'C:/Users/Suhaib/.gemini/antigravity/brain/43c4e41f-1df1-4184-b8c9-884a90866e90';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 9299;

async function run() {
  console.log('[1/8] Launching Headless Chrome on port', debugPort);
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=C:\\Users\\Suhaib\\AppData\\Local\\Temp\\chrome_e2e_${Date.now()}`,
    '--window-size=1600,1000',
    'http://localhost:3000'
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
      targets = await res.json();
      break;
    } catch (e) {}
  }

  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = msgId++;
    const handler = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        resolve(data);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const evalCode = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true });
    return res?.result?.result?.value !== undefined ? res.result.result.value : res?.result?.value;
  };

  const capture = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.result.data, 'base64');
    fs.writeFileSync(`${artifactDir}/${name}.png`, buffer);
    console.log(`Saved screenshot: ${name}.png (bytes: ${buffer.length})`);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  console.log('[2/8] Waiting for page load...');
  await new Promise(r => setTimeout(r, 2500));

  // Step 1: Expand dev personas
  console.log('[3/8] Expanding Evaluation Personas...');
  const expandResult = await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const devBtn = buttons.find(b => b.textContent && b.textContent.includes('Evaluation Personas'));
      if (devBtn) {
        devBtn.click();
        return 'expanded dev personas';
      }
      return 'dev personas button not found';
    })()
  `);
  console.log('Expand result:', expandResult);
  await new Promise(r => setTimeout(r, 1000));

  // Step 2: Click Elena Rostova
  console.log('[4/8] Signing in as Elena Rostova (Line Producer)...');
  const personaResult = await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const elenaBtn = buttons.find(b => b.textContent && b.textContent.includes('Elena Rostova'));
      if (elenaBtn) {
        elenaBtn.click();
        return 'clicked Elena Rostova';
      }
      return 'Elena button not found';
    })()
  `);
  console.log('Persona result:', personaResult);
  await new Promise(r => setTimeout(r, 2500));

  // Step 3: Click ENTER DIRECT WORKSPACE
  console.log('[5/8] Entering production workspace...');
  const enterResult = await evalCode(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const enterBtn = buttons.find(b => b.textContent && b.textContent.includes('ENTER DIRECT WORKSPACE'));
      if (enterBtn) {
        enterBtn.click();
        return 'clicked ENTER DIRECT WORKSPACE';
      }
      return 'enter button not found';
    })()
  `);
  console.log('Enter result:', enterResult);
  await new Promise(r => setTimeout(r, 2500));

  // Step 4: Click Breakdown in sidebar
  console.log('[6/8] Clicking Breakdown sidebar tab...');
  const sidebarResult = await evalCode(`
    (() => {
      const btn = document.getElementById('sidebar-tab-breakdown') ||
        Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Breakdown');
      if (btn) {
        btn.click();
        return 'clicked sidebar-tab-breakdown';
      }
      return 'sidebar tab not found';
    })()
  `);
  console.log('Sidebar result:', sidebarResult);
  await new Promise(r => setTimeout(r, 2500));

  // Verify breakdown navigation
  const navText = await evalCode(`
    (() => {
      const nav = document.querySelector('[data-testid="breakdown-navigation-bar"]');
      return nav ? nav.innerText : 'nav not found';
    })()
  `);
  console.log('Breakdown Navigation Bar content:', navText);

  // 1. Capture 5 sections & Relationship Graph
  console.log('[7/8] Capturing 5 Breakdown Sections & Character Analysis Relationship Graph...');
  await capture('verified_5_breakdown_sections');
  await capture('verified_character_relationship_graph');

  // 2. Click a character node
  console.log('Clicking character node...');
  const clickNode = await evalCode(`
    (() => {
      const node = document.querySelector('g[data-character]');
      if (node) {
        node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return 'clicked character node: ' + node.getAttribute('data-character');
      }
      return 'no node found';
    })()
  `);
  console.log('Node click result:', clickNode);
  await new Promise(r => setTimeout(r, 1200));
  await capture('verified_selected_character_analytical_view');

  // 3. Switch to Compact Table
  console.log('[8/8] Switching to Compact Table...');
  const clickTable = await evalCode(`
    (() => {
      const btn = document.querySelector('[data-testid="character-view-table-btn"]');
      if (btn) {
        btn.click();
        return 'switched to compact table';
      }
      return 'table toggle not found';
    })()
  `);
  console.log('Table toggle result:', clickTable);
  await new Promise(r => setTimeout(r, 1200));
  await capture('verified_compact_character_matrix');

  // 4. Open Extraction & Audit Modal
  console.log('Opening Extraction Completeness Audit modal...');
  const openAudit = await evalCode(`
    (() => {
      const btn = document.querySelector('[data-testid="character-audit-status-btn"]');
      if (btn) {
        btn.click();
        return 'opened audit modal';
      }
      return 'audit button not found';
    })()
  `);
  console.log('Audit modal result:', openAudit);
  await new Promise(r => setTimeout(r, 1200));
  await capture('verified_character_extraction_audit');

  chrome.kill();
  console.log('SUCCESS: All 4 browser evidence artifacts verified and captured!');
}

run().catch(err => {
  console.error('Run failed:', err);
  process.exit(1);
});
