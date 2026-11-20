import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve('C:\\Users\\Suhaib\\.gemini\\antigravity\\scratch\\edge_debug_profile_disclosures');
const SCREENSHOT_DIR = path.resolve('C:\\Users\\Suhaib\\.gemini\\antigravity\\scratch\\screenshots');

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

async function main() {
  const port = 9335;
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${USER_DATA_DIR}`,
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

    // Click Countdown to toggle inline disclosure
    const countdownClickResult = await sendCommand(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const countdown = document.querySelector('[aria-label*="Target wrap countdown"]');
          if (countdown) {
            countdown.click();
            return { clicked: true, found: true };
          }
          return { clicked: false, found: false };
        })()
      `,
      returnByValue: true
    });
    console.log('Countdown click result:', countdownClickResult.value);
    await new Promise(r => setTimeout(r, 500));

    const shot1 = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'overview_countdown_expanded.png'), Buffer.from(shot1.data, 'base64'));
    console.log('Saved overview_countdown_expanded.png');

    // Click Details button on Operational Attention
    const detailsClickResult = await sendCommand(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const detailsBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Details');
          if (detailsBtn) {
            detailsBtn.click();
            return { clicked: true, found: true };
          }
          return { clicked: false, found: false };
        })()
      `,
      returnByValue: true
    });
    console.log('Details click result:', detailsClickResult.value);
    await new Promise(r => setTimeout(r, 500));

    const shot2 = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'overview_all_disclosures_active.png'), Buffer.from(shot2.data, 'base64'));
    console.log('Saved overview_all_disclosures_active.png');

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

main().catch(console.error);
