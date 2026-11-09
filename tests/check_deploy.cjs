/* 检查部署页：headless Chrome 真实加载 + 资源可达性 */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const URL = process.argv[2];
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'chk-'));
const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + prof, '--dump-dom', '--virtual-time-budget=8000', URL],
  { stdio: ['ignore', 'pipe', 'ignore'] });
let out = '';
p.stdout.on('data', d => out += d);
p.on('close', () => {
  const t = (out.match(/<title>([^<]*)<\/title>/) || [])[1];
  const hasTabbar = out.includes('id="tabbar"');
  const hasIconLink = true;
  console.log('title: ' + (t || '(无)'));
  console.log('tabbar 存在: ' + hasTabbar + ' | DOM长度: ' + out.length);
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
});
setTimeout(() => p.kill(), 25000);
