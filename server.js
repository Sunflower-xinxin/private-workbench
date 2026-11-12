/*
 * Private Workbench server
 * - Serves the PWA from this repository (no Windows-only absolute paths)
 * - Provides one-account authentication, record sync and binary file storage
 * - Uses only Node.js built-ins so the project has no install step
 *
 * Production must provide a persistent WORKBENCH_DATA_DIR. Ephemeral disks will
 * lose user data when the host restarts.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8797);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve(process.env.WORKBENCH_DATA_DIR || path.join(ROOT, '.data'));
const FILE_DIR = path.join(DATA_DIR, 'files');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'snapshot.json');
const ADMIN_EMAIL = String(process.env.WORKBENCH_ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.WORKBENCH_ADMIN_PASSWORD || '');
const SESSION_SECRET = String(process.env.WORKBENCH_SESSION_SECRET || '');
const ALLOWED_ORIGINS = String(process.env.WORKBENCH_ALLOWED_ORIGINS || '')
  .split(',').map(x => x.trim()).filter(Boolean);
const ACTIVE_MODULES = new Set(['books', 'english', 'movies', 'outfit', 'job', 'prompt', 'life', 'travel']);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json; charset=utf-8'
};

let snapshot = { version: 1, records: {}, deleted: {}, updatedAt: 0 };
let saveChain = Promise.resolve();

function b64url(value) { return Buffer.from(value).toString('base64url'); }
function signToken(email) {
  const payload = b64url(JSON.stringify({ sub: email, exp: Date.now() + 30 * 86400000 }));
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}
function verifyToken(req) {
  if (!SESSION_SECRET || !ADMIN_EMAIL) return false;
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.sub === ADMIN_EMAIL && Number(data.exp) > Date.now();
  } catch (_) { return false; }
}

function corsHeaders(req) {
  const origin = String(req.headers.origin || '');
  const allowed = !origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);
  return allowed && origin ? {
    'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Type, X-File-Name',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  } : {};
}
function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-store' }, headers || {}));
  res.end(body);
}
function json(res, status, value, req) {
  send(res, status, JSON.stringify(value), Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders(req)));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { reject(Object.assign(new Error('payload_too_large'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit = 2 * 1024 * 1024) {
  const body = await readBody(req, limit);
  try { return JSON.parse(body.toString('utf8') || '{}'); }
  catch (_) { throw Object.assign(new Error('invalid_json'), { status: 400 }); }
}

function normalizeSnapshot(input) {
  const out = { version: 1, records: {}, deleted: {}, updatedAt: Number(input && input.updatedAt) || 0 };
  ACTIVE_MODULES.forEach(module => {
    const records = input && input.records && input.records[module];
    const deleted = input && input.deleted && input.deleted[module];
    out.records[module] = Array.isArray(records) ? records.filter(x => x && x.id) : [];
    out.deleted[module] = deleted && typeof deleted === 'object' ? deleted : {};
  });
  return out;
}
async function persistSnapshot() {
  snapshot.updatedAt = Date.now();
  const temp = SNAPSHOT_FILE + '.tmp';
  saveChain = saveChain.then(async () => {
    await fsp.writeFile(temp, JSON.stringify(snapshot), { mode: 0o600 });
    await fsp.rename(temp, SNAPSHOT_FILE);
  });
  return saveChain;
}
function mergeSnapshot(client) {
  const incoming = normalizeSnapshot(client);
  ACTIVE_MODULES.forEach(module => {
    const serverItems = new Map((snapshot.records[module] || []).map(x => [x.id, x]));
    const serverDeleted = snapshot.deleted[module] || (snapshot.deleted[module] = {});
    incoming.records[module].forEach(item => {
      const itemTs = Number(item.updatedAt || item.createdAt) || 0;
      const old = serverItems.get(item.id);
      const oldTs = old ? (Number(old.updatedAt || old.createdAt) || 0) : 0;
      const deletedTs = Number(serverDeleted[item.id]) || 0;
      if (itemTs >= oldTs && itemTs > deletedTs) {
        serverItems.set(item.id, item); delete serverDeleted[item.id];
      }
    });
    Object.entries(incoming.deleted[module] || {}).forEach(([id, rawTs]) => {
      const ts = Number(rawTs) || 0;
      const old = serverItems.get(id);
      const oldTs = old ? (Number(old.updatedAt || old.createdAt) || 0) : 0;
      if (ts >= oldTs && ts >= (Number(serverDeleted[id]) || 0)) {
        serverItems.delete(id); serverDeleted[id] = ts;
      }
    });
    snapshot.records[module] = Array.from(serverItems.values());
  });
}
function safeFilePart(value) { return /^[a-zA-Z0-9_-]{6,160}$/.test(value || '') ? value : ''; }

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') { send(res, 204, '', corsHeaders(req)); return; }
  if (url.pathname === '/api/health' && req.method === 'GET') {
    json(res, 200, { ok: true, configured: !!(ADMIN_EMAIL && ADMIN_PASSWORD && SESSION_SECRET) }, req); return;
  }
  if (url.pathname === '/api/login' && req.method === 'POST') {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SESSION_SECRET) {
      json(res, 503, { ok: false, error: 'server_not_configured' }, req); return;
    }
    const body = await readJson(req, 64 * 1024);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const emailHash = crypto.createHash('sha256').update(email).digest();
    const expectedEmailHash = crypto.createHash('sha256').update(ADMIN_EMAIL).digest();
    const passwordHash = crypto.createHash('sha256').update(password).digest();
    const expectedHash = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
    if (!crypto.timingSafeEqual(emailHash, expectedEmailHash) || !crypto.timingSafeEqual(passwordHash, expectedHash)) {
      json(res, 401, { ok: false, error: 'invalid_credentials' }, req); return;
    }
    json(res, 200, { ok: true, token: signToken(email), email }, req); return;
  }
  if (!verifyToken(req)) { json(res, 401, { ok: false, error: 'unauthorized' }, req); return; }

  if (url.pathname === '/api/sync' && req.method === 'POST') {
    const body = await readJson(req, 8 * 1024 * 1024);
    mergeSnapshot(body); await persistSnapshot(); json(res, 200, snapshot, req); return;
  }
  const fileMatch = url.pathname.match(/^\/api\/files\/([^/]+)(?:\/(original|thumb))?$/);
  if (fileMatch) {
    const id = safeFilePart(fileMatch[1]);
    const variant = fileMatch[2] || 'original';
    if (!id) { json(res, 400, { ok: false, error: 'invalid_file_id' }, req); return; }
    const filePath = path.join(FILE_DIR, id + '.' + variant);
    const metaPath = path.join(FILE_DIR, id + '.json');
    if (req.method === 'PUT') {
      const data = await readBody(req, 35 * 1024 * 1024);
      const type = String(req.headers['x-file-type'] || req.headers['content-type'] || 'application/octet-stream').slice(0, 200);
      const name = String(req.headers['x-file-name'] || '').slice(0, 240);
      await fsp.writeFile(filePath, data, { mode: 0o600 });
      let meta = {}; try { meta = JSON.parse(await fsp.readFile(metaPath, 'utf8')); } catch (_) {}
      meta[variant] = { type, name, size: data.length, updatedAt: Date.now() };
      await fsp.writeFile(metaPath, JSON.stringify(meta), { mode: 0o600 });
      json(res, 200, { ok: true, id, variant }, req); return;
    }
    if (req.method === 'GET') {
      try {
        const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
        const data = await fsp.readFile(filePath);
        send(res, 200, data, Object.assign({ 'Content-Type': (meta[variant] && meta[variant].type) || 'application/octet-stream' }, corsHeaders(req)));
      } catch (_) { json(res, 404, { ok: false, error: 'file_not_found' }, req); }
      return;
    }
    if (req.method === 'DELETE') {
      await Promise.all(['original', 'thumb', 'json'].map(ext => fsp.unlink(path.join(FILE_DIR, id + '.' + ext)).catch(() => {})));
      json(res, 200, { ok: true }, req); return;
    }
  }
  json(res, 404, { ok: false, error: 'not_found' }, req);
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const target = path.resolve(ROOT, '.' + pathname);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) { send(res, 403, 'forbidden'); return; }
  try {
    const stat = await fsp.stat(target);
    const filePath = stat.isDirectory() ? path.join(target, 'index.html') : target;
    const data = await fsp.readFile(filePath);
    send(res, 200, data, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  } catch (_) { send(res, 404, 'not found', { 'Content-Type': 'text/plain; charset=utf-8' }); }
}

async function start() {
  await fsp.mkdir(FILE_DIR, { recursive: true, mode: 0o700 });
  try { snapshot = normalizeSnapshot(JSON.parse(await fsp.readFile(SNAPSHOT_FILE, 'utf8'))); }
  catch (_) { snapshot = normalizeSnapshot({}); }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const work = url.pathname.startsWith('/api/') ? handleApi(req, res, url) : serveStatic(req, res, url);
    Promise.resolve(work).catch(err => {
      if (res.headersSent) { res.destroy(); return; }
      json(res, err.status || 500, { ok: false, error: err.message || 'server_error' }, req);
    });
  });
  server.listen(PORT, HOST, () => {
    console.log(`Private Workbench listening on http://${HOST}:${PORT}`);
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SESSION_SECRET) console.warn('Cloud sync is disabled: configure WORKBENCH_ADMIN_EMAIL, WORKBENCH_ADMIN_PASSWORD and WORKBENCH_SESSION_SECRET.');
  });
}

start().catch(err => { console.error(err); process.exit(1); });
