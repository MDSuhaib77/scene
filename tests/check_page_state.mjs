import { spawn } from 'child_process';

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9298',
  '--user-data-dir=C:\\Users\\Suhaib\\AppData\\Local\\Temp\\chk_' + Date.now(),
  'http://localhost:3000'
]);

async function check() {
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9298/json');
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const send = (method, params = {}) => new Promise(resolve => {
    const id = msgId++;
    const handler = e => {
      const d = JSON.parse(e.data);
      if (d.id === id) {
        ws.removeEventListener('message', handler);
        resolve(d);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Runtime.enable');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const devBtn = buttons.find(b => b.textContent && b.textContent.includes("Evaluation Personas"));
      if (devBtn) devBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const elenaBtn = buttons.find(b => b.textContent && b.textContent.includes("Elena Rostova"));
      if (elenaBtn) elenaBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 2000));

  const textRes = await send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true });
  console.log('=== PAGE TEXT AFTER ELENA CLICK ===\n', textRes.result.result.value);
  
  const buttonsRes = await send('Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll("button")).map(b => b.innerText.trim()).filter(Boolean)`,
    returnByValue: true
  });
  console.log('=== BUTTONS FOUND ===\n', buttonsRes.result.result.value);

  chrome.kill();
}

check().catch(e => { console.error(e); chrome.kill(); });
