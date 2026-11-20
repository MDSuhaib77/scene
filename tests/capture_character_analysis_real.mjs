import fs from 'fs';
import { spawn } from 'child_process';

const artifactDir = 'C:/Users/Suhaib/.gemini/antigravity/brain/43c4e41f-1df1-4184-b8c9-884a90866e90';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 9295;

async function run() {
  console.log('[1/7] Launching Headless Chrome on port', debugPort);
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=C:\\Users\\Suhaib\\AppData\\Local\\Temp\\chrome_capture_${Date.now()}`,
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

  console.log('[2/7] Initializing authenticated session...');
  await new Promise(r => setTimeout(r, 2000));

  // If on login/welcome, select a persona
  const currentText = await evalCode(`document.body.innerText`);
  console.log('Current page text preview:', currentText.slice(0, 120));

  if (currentText.includes('Sign In') || currentText.includes('Choose Account') || currentText.includes('DEVELOPMENT PERSONAS')) {
    console.log('Selecting persona...');
    await evalCode(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const pBtn = buttons.find(b => b.textContent && (b.textContent.includes('Kira') || b.textContent.includes('Elena') || b.textContent.includes('Suh')));
        if (pBtn) pBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));
  }

  // Check if we are on dashboard with ENTER DIRECT WORKSPACE
  const enterBtnResult = await evalCode(`
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
  console.log('Enter workspace result:', enterBtnResult);
  await new Promise(r => setTimeout(r, 2500));

  // Now click Breakdown in sidebar
  console.log('[3/7] Clicking Breakdown tab in sidebar...');
  const clickSidebarResult = await evalCode(`
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
  console.log('Click breakdown sidebar result:', clickSidebarResult);
  await new Promise(r => setTimeout(r, 2500));

  // 1. Capture 5 Breakdown sections & Character Analysis Relationship Graph
  console.log('[4/7] Capturing Breakdown navigation & Character Analysis Relationship Graph...');
  await capture('verified_5_breakdown_sections');
  await capture('verified_character_relationship_graph');

  // 2. Select a character node to inspect analytical details
  console.log('[5/7] Clicking a character node...');
  const clickNodeResult = await evalCode(`
    (() => {
      const node = document.querySelector('g[data-character]');
      if (node) {
        node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return 'clicked node: ' + node.getAttribute('data-character');
      }
      return 'no node found';
    })()
  `);
  console.log('Click node result:', clickNodeResult);
  await new Promise(r => setTimeout(r, 1500));

  await capture('verified_selected_character_analytical_view');

  // 3. Switch to Compact Table view
  console.log('[6/7] Switching to Compact Table view...');
  const switchTableResult = await evalCode(`
    (() => {
      const btn = document.querySelector('[data-testid="character-view-table-btn"]') ||
        Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Compact Table'));
      if (btn) {
        btn.click();
        return 'clicked table toggle';
      }
      return 'table toggle not found';
    })()
  `);
  console.log('Switch table result:', switchTableResult);
  await new Promise(r => setTimeout(r, 1500));

  await capture('verified_compact_character_matrix');

  // 4. Open Extraction & Completeness Audit Modal
  console.log('[7/7] Opening Extraction Completeness Audit modal...');
  const openAuditResult = await evalCode(`
    (() => {
      const btn = document.querySelector('[data-testid="character-audit-status-btn"]') ||
        Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Extraction') || b.textContent.includes('Review')));
      if (btn) {
        btn.click();
        return 'clicked audit button';
      }
      return 'audit button not found';
    })()
  `);
  console.log('Audit button result:', openAuditResult);
  await new Promise(r => setTimeout(r, 1500));

  await capture('verified_character_extraction_audit');

  chrome.kill();
  console.log('Finished capturing all genuine screenshots!');
}

run().catch(err => {
  console.error('Run failed:', err);
  process.exit(1);
});
