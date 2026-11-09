/* 检查发布页真实渲染：是否有 iframe、iframe 内工作台是否渲染 */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const URL = process.argv[2];
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'chk2-'));
const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + prof,
   '--remote-debugging-port=0', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
p.stderr.on('data', d => { const m = String(d).match(/ws:\/\/127\.0\.0\.1:\d+\/\S+/); if (m && !wsUrl) wsUrl = m[0]; });

(async () => {
  for (let i = 0; i < 100 && !wsUrl; i++) await sleep(100);
  if (!wsUrl) { console.log('NO WS'); p.kill(); return; }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pending = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}, sid) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify(Object.assign({ id, method, params }, sid ? { sessionId: sid } : {}))); });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Page.navigate', { url: URL }, sessionId);
  await sleep(6000);
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }, sessionId); return r.result && r.result.result ? r.result.result.value : undefined; };
  const iframes = await ev(`Array.from(document.querySelectorAll('iframe')).map(f=>f.src).join('|') || 'NO_IFRAME'`);
  const title = await ev('document.title');
  // 检查 iframe 内是否渲染了工作台（tabbar）
  const inner = await ev(`(function(){ var f=document.querySelector('iframe'); if(!f) return 'no iframe'; try { var d=f.contentDocument; return d ? (d.querySelector('#tabbar') ? 'TABBAR_RENDERED' : 'no tabbar; bodyLen='+d.body.innerHTML.length) : 'cross-origin'; } catch(e){ return 'err:'+e.message; } })()`);
  console.log('title:', title);
  console.log('iframes:', iframes);
  console.log('iframe 内容:', inner);
  ws.close(); p.kill();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
})();
