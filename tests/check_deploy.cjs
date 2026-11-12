/* 检查部署页：headless Chrome 真实加载 + 资源可达性 */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const URL = process.argv[2];
const CHROME = process.env.CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome');
if (!fs.existsSync(CHROME)) { console.log('SKIP: Chrome 未安装，可通过 CHROME_PATH 指定'); process.exit(0); }
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'chk-'));
const p = spawn(CHROME,
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
