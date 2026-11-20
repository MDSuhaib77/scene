import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve('C:\\Users\\Suhaib\\.gemini\\antigravity\\scratch\\edge_debug_profile_flanks');
const SCREENSHOT_DIR = path.resolve('C:\\Users\\Suhaib\\.gemini\\antigravity\\scratch\\screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function getDebuggerUrl(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(t => t.type === 'page') || list[0];
          resolve(page.webSocketDebuggerUrl);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

function sendCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.off('message', handler);
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function testDesktopViewports() {
  const port = 9336;
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${USER_DATA_DIR}_desktop`,
    `--window-size=1440,900`,
    '--headless=new',
    '--hide-scrollbars',
    '--disable-gpu',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const wsUrl = await getDebuggerUrl(port);
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve) => ws.on('open', resolve));

    await sendCommand(ws, 'Page.enable');
    await sendCommand(ws, 'DOM.enable');

    // 1. Test 1440x900 (Collapsed)
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:3000/' });
    await new Promise(r => setTimeout(r, 2000));

    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `
        localStorage.setItem('cp_uname', 'Elena Rostova');
        localStorage.setItem('cp_urole', 'Line Producer');
        localStorage.setItem('cp_screen', 'editor');
        localStorage.setItem('sceneos_onboarding_completed_Elena Rostova', 'true');
        location.reload();
      `
    });
    await new Promise(r => setTimeout(r, 2500));

    // Capture 1440x900 collapsed state
    const shot1440Collapsed = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'flank_1440x900_collapsed.png'), Buffer.from(shot1440Collapsed.data, 'base64'));
    console.log('Saved flank_1440x900_collapsed.png');

    // Expand Attention on 1440x900
    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `
        const btn = document.getElementById('operational-attention-trigger');
        if (btn) btn.click();
      `
    });
    await new Promise(r => setTimeout(r, 500));
    const shot1440AttExpanded = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'flank_1440x900_attention_expanded.png'), Buffer.from(shot1440AttExpanded.data, 'base64'));
    console.log('Saved flank_1440x900_attention_expanded.png');

    // Switch directly to Activity (should close Attention and open Activity)
    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `
        const btn = document.getElementById('recent-activity-trigger');
        if (btn) btn.click();
      `
    });
    await new Promise(r => setTimeout(r, 500));
    const shot1440ActExpanded = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'flank_1440x900_activity_expanded.png'), Buffer.from(shot1440ActExpanded.data, 'base64'));
    console.log('Saved flank_1440x900_activity_expanded.png');

    // Collapse via Escape
    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      `
    });
    await new Promise(r => setTimeout(r, 400));
    const shot1440Esc = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'flank_1440x900_escaped_collapsed.png'), Buffer.from(shot1440Esc.data, 'base64'));
    console.log('Saved flank_1440x900_escaped_collapsed.png');

    // 2. Test 1280x720 (Compact Laptop)
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise(r => setTimeout(r, 800));
    const shot1280Collapsed = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'flank_1280x720_collapsed.png'), Buffer.from(shot1280Collapsed.data, 'base64'));
    console.log('Saved flank_1280x720_collapsed.png');

    // 3. Test 390x844 (Mobile)
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise(r => setTimeout(r, 800));

    // Scroll to identity section so controls are in view
    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `
        const el = document.querySelector('[aria-label="Production Identity and Countdown"]');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      `
    });
    await new Promise(r => setTimeout(r, 500));

    const shot390Collapsed = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'flank_390x844_mobile_collapsed.png'), Buffer.from(shot390Collapsed.data, 'base64'));
    console.log('Saved flank_390x844_mobile_collapsed.png');

    // Test Mobile horizontal overflow
    const overflowCheck = await sendCommand(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          return {
            documentWidth: document.documentElement.scrollWidth,
            windowWidth: window.innerWidth,
            hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Mobile overflow check:', overflowCheck.result ? overflowCheck.result.value : overflowCheck);

    // Expand Attention on mobile
    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `
        const btn = document.getElementById('operational-attention-trigger');
        if (btn) btn.click();
      `
    });
    await new Promise(r => setTimeout(r, 500));
    const shot390AttExpanded = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'flank_390x844_mobile_attention_expanded.png'), Buffer.from(shot390AttExpanded.data, 'base64'));
    console.log('Saved flank_390x844_mobile_attention_expanded.png');

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

testDesktopViewports().catch(console.error);
