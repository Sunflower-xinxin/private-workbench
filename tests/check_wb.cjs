/* 检查工作台是否真正渲染：加载 URL，报告 #tabbar/#view 内容与 JS 报错 */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const URL = process.argv[2];
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'chk3-'));
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
  let seq = 0; const pending = new Map(); const errs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown' || m.method === 'Log.entryAdded') errs.push(m.method);
  };
  const send = (method, params = {}, sid) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify(Object.assign({ id, method, params }, sid ? { sessionId: sid } : {}))); });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Page.navigate', { url: URL }, sessionId);
  await sleep(7000);
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }, sessionId); return r.result && r.result.result ? r.result.result.value : undefined; };
  const title = await ev('document.title');
  const viewLen = await ev(`(document.getElementById('view')||{}).innerHTML ? document.getElementById('view').innerHTML.length : -1`);
  const tabLen = await ev(`(document.getElementById('tabbar')||{}).innerHTML ? document.getElementById('tabbar').innerHTML.length : -1`);
  const tabText = await ev(`document.getElementById('tabbar') ? document.getElementById('tabbar').textContent.trim().slice(0,60) : 'NO_TAB'`);
  const hasStore = await ev(`typeof window.PWStore !== 'undefined'`);
  const bodySnip = await ev(`document.body ? document.body.innerText.slice(0,200) : ''`);
  console.log('title:', title);
  console.log('PWStore 存在:', hasStore);
  console.log('#view 长度:', viewLen, '| #tabbar 长度:', tabLen);
  console.log('#tabbar 文本:', tabText);
  console.log('body 文本片段:', JSON.stringify(bodySnip));
  console.log('运行时异常数:', errs.length);
  ws.close(); p.kill();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
})();
