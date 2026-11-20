import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve('C:\\Users\\Suhaib\\.gemini\\antigravity\\scratch\\edge_debug_profile');
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

async function runViewportTest(viewport) {
  const { width, height, name } = viewport;
  console.log(`\n=== Testing Viewport: ${name} (${width}x${height}) ===`);

  const port = 9333;
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${USER_DATA_DIR}_${name}`,
    `--window-size=${width},${height}`,
    '--headless=new',
    '--hide-scrollbars',
    '--disable-gpu',
    'about:blank'
  ]);

  // Wait for Edge to start
  await new Promise(r => setTimeout(r, 1500));

  try {
    const wsUrl = await getDebuggerUrl(port);
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve) => ws.on('open', resolve));

    await sendCommand(ws, 'Page.enable');
    await sendCommand(ws, 'DOM.enable');
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });

    // Navigate to local dev server
    await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:3000/' });
    await new Promise(r => setTimeout(r, 2000));

    // Seed localStorage so user lands directly in editor on Overview
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

    // Measure viewport and elements
    const metricsResult = await sendCommand(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const overview = document.getElementById('executive-project-overview');
          const pulse = document.getElementById('integrated-production-pulse');
          const operational = document.querySelector('section[aria-label="Operational Signal and Risks"]');
          const milestone = document.querySelector('section[aria-label="Milestone Progression Track"]');
          const countdown = document.querySelector('section[aria-label="Production Identity and Countdown"]');

          return {
            windowInnerHeight: window.innerHeight,
            windowInnerWidth: window.innerWidth,
            overviewFound: Boolean(overview),
            overviewTotalHeight: overview ? overview.offsetHeight : 0,
            countdownHeight: countdown ? countdown.offsetHeight : 0,
            pulseHeight: pulse ? pulse.offsetHeight : 0,
            milestoneHeight: milestone ? milestone.offsetHeight : 0,
            operationalHeight: operational ? operational.offsetHeight : 0,
            fitsInViewportWithoutScroll: overview ? (overview.getBoundingClientRect().bottom <= window.innerHeight + 100) : false,
            initialViewportBottom: overview ? (pulse ? pulse.getBoundingClientRect().bottom : 0) : 0,
            leadingRiskVisible: operational ? (operational.getBoundingClientRect().top < window.innerHeight) : false,
          };
        })()
      `,
      returnByValue: true
    });

    // Capture initial screenshot
    const screenshot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(SCREENSHOT_DIR, `overview_${name}_${width}x${height}.png`);
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`Saved screenshot to: ${screenshotPath}`);

    // If laptop_wide, also test and capture progressive disclosure panel click
    if (name === 'laptop_wide') {
      await sendCommand(ws, 'Runtime.evaluate', {
        expression: `
          const inst = document.querySelector('div[title*="Task Execution"]');
          if (inst) inst.click();
        `
      });
      await new Promise(r => setTimeout(r, 600));
      const disclosureShot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
      const discPath = path.join(SCREENSHOT_DIR, 'overview_disclosure_open.png');
      fs.writeFileSync(discPath, Buffer.from(disclosureShot.data, 'base64'));
      console.log(`Saved progressive disclosure screenshot to: ${discPath}`);
    }

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

async function main() {
  const viewports = [
    { name: 'laptop_wide', width: 1440, height: 900 },
    { name: 'laptop_compact', width: 1280, height: 720 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    try {
      await runViewportTest(vp);
    } catch (err) {
      console.error(`Error testing viewport ${vp.name}:`, err.message);
    }
  }
  console.log('\nAll viewport tests completed.');
}

main().catch(console.error);
