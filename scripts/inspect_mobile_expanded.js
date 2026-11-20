import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve('C:\\Users\\Suhaib\\.gemini\\antigravity\\scratch\\edge_debug_profile_mob_exp');
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
  const port = 9339;
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    `--window-size=390,844`,
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
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
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

    // Scroll to the trigger button
    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `
        const btn = document.getElementById('operational-attention-trigger');
        if (btn) {
          btn.scrollIntoView({ behavior: 'instant', block: 'center' });
          btn.click();
        }
      `
    });
    await new Promise(r => setTimeout(r, 800));

    const shot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'flank_390x844_mobile_attention_expanded.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved flank_390x844_mobile_attention_expanded.png');

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

main().catch(console.error);
