/* =====================================================================
 * cdp.mjs — 无依赖 CDP 验收驱动（Node ≥22，内置 WebSocket）
 * 用法：node tests/cdp.mjs "<url>" "<截图输出.png>" [最长等待毫秒]
 * 流程：启动 headless Chrome（远程调试）→ 打开页面 → 轮询 #banner
 *       直到出现 PASS/FAIL → 截图 → 输出 banner 文本并按结果退出。
 * ===================================================================== */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2];
const shotPath = process.argv[3] || '';
const maxWait = Number(process.argv[4] || 45000);
if (!url) { console.error('用法: node cdp.mjs <url> [screenshot.png] [maxWaitMs]'); process.exit(2); }

const CHROME = process.env.CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome');
if (!existsSync(CHROME)) { console.log('SKIP: Chrome 未安装，可通过 CHROME_PATH 指定'); process.exit(0); }
const profile = process.env.CDP_PROFILE || mkdtempSync(join(tmpdir(), 'cdp-prof-'));
const keepProfile = !!process.env.CDP_PROFILE;
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--window-size=393,880',
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
  const events = [];
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}, sessionId) => new Promise(res => {
    const id = ++seq;
    pending.set(id, res);
    ws.send(JSON.stringify(Object.assign({ id, method, params }, sessionId ? { sessionId } : {})));
  });

  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 880, deviceScaleFactor: 2, mobile: true }, sessionId);
  await send('Page.navigate', { url }, sessionId);

  const evalJS = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
    return r.result && r.result.result ? r.result.result.value : undefined;
  };

  let banner = '';
  const t0 = Date.now();
  while (Date.now() - t0 < maxWait) {
    await sleep(400);
    banner = (await evalJS('document.getElementById("banner") ? document.getElementById("banner").textContent : ""')) || '';
    if (/^(PASS|FAIL)/.test(banner)) break;
  }
  if (!banner) banner = 'FAIL | 超时未获得结果';
  if (shotPath) {
    const { result } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    if (result && result.data) writeFileSync(shotPath, Buffer.from(result.data, 'base64'));
  }
  console.log(banner);
  try { ws.close(); } catch (e) {}
  proc.kill();
  await sleep(300);
  if (!keepProfile) { try { rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
  process.exit(banner.startsWith('PASS') ? 0 : 1);
}

main().catch(e => { console.error('CDP 驱动失败: ' + e.message); try { proc.kill(); } catch (x) {} process.exit(2); });
