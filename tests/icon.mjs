/* =====================================================================
 * icon.mjs — 用 headless Chrome canvas 生成 180×180 PNG 桌面图标
 * 用法：node tests/icon.mjs <源图URL> <输出.png>
 * ===================================================================== */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2];
const outPath = process.argv[3] || 'apple-touch-icon.png';
if (!url) { console.error('用法: node icon.mjs <图片URL> <输出.png>'); process.exit(2); }

const CHROME = process.env.CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome');
if (!existsSync(CHROME)) { console.log('SKIP: Chrome 未安装，可通过 CHROME_PATH 指定'); process.exit(0); }
const profile = mkdtempSync(join(tmpdir(), 'icon-prof-'));
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--window-size=500,500',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
proc.stderr.on('data', d => {
  const m = String(d).match(/ws:\/\/127\.0\.0\.1:\d+\/\S+/);
  if (m && !wsUrl) wsUrl = m[0];
});

async function main() {
  for (let i = 0; i < 100 && !wsUrl; i++) await sleep(100);
  if (!wsUrl) throw new Error('未获取到 DevTools WebSocket 地址');
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}, sessionId) => new Promise(res => {
    const id = ++seq; pending.set(id, res);
    ws.send(JSON.stringify(Object.assign({ id, method, params }, sessionId ? { sessionId } : {})));
  });

  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Page.navigate', { url }, sessionId);

  let dataUrl = '';
  for (let i = 0; i < 40 && !dataUrl; i++) {
    await sleep(300);
    const r = await send('Runtime.evaluate', {
      awaitPromise: true, returnByValue: true,
      expression: `(async () => {
        try {
          const img = document.querySelector('img');
          if (!img) return 'ERR no img';
          if (!img.complete) return 'ERR not complete';
          if (!img.naturalWidth) return 'ERR naturalWidth=0';
          const c = document.createElement('canvas'); c.width = 180; c.height = 180;
          const g = c.getContext('2d');
          g.fillStyle = '#fff'; g.fillRect(0, 0, 180, 180);
          g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
          g.drawImage(img, 0, 0, 180, 180);
          return c.toDataURL('image/png');
        } catch (e) { return 'ERR ' + e.message; }
      })()`
    }, sessionId);
    const v = r.result && r.result.result && r.result.result.value;
    if (v && typeof v === 'string' && v.startsWith('ERR')) { if (i === 38) throw new Error(v); continue; }
    dataUrl = v || '';
  }
  if (!dataUrl) throw new Error('canvas 导出失败');
  const b64 = dataUrl.split(',')[1];
  writeFileSync(outPath, Buffer.from(b64, 'base64'));
  console.log('ICON OK ' + outPath + ' (' + Buffer.from(b64, 'base64').length + ' bytes)');
  try { ws.close(); } catch (e) {}
  proc.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  process.exit(0);
}

main().catch(e => { console.error('失败: ' + e.message); try { proc.kill(); } catch (x) {} process.exit(2); });
