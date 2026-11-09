const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = 'E:\\wps2\\PrivateWorkbench\\prototype';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p.startsWith('/__wait/')) {          // 测试辅助：延迟响应，供验收页压住 load 事件
    const ms = Math.min(30000, parseInt(p.split('/')[2], 10) || 0);
    setTimeout(() => { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('ok'); }, ms);
    return;
  }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(8797, '127.0.0.1', () => console.log('serving on 8797'));
