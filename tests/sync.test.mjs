import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(join(tmpdir(), 'private-workbench-sync-'));
const port = 18797;
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env, PORT: String(port), HOST: '127.0.0.1', WORKBENCH_DATA_DIR: dataDir,
  WORKBENCH_ADMIN_EMAIL: '', WORKBENCH_ADMIN_PASSWORD: '',
  WORKBENCH_SESSION_SECRET: 'test-only-session-secret-at-least-32-characters'
};
const accountEmail = 'owner@example.com';
const accountPassword = 'correct-horse-battery-staple';
let child;

function start() {
  child = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  return child;
}
async function ready() {
  for (let i = 0; i < 80; i++) {
    try { const res = await fetch(base + '/api/health'); if (res.ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('server_start_timeout');
}
async function register(email = accountEmail, password = accountPassword) {
  return fetch(base + '/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
  });
}
async function login(password = accountPassword) {
  return fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: accountEmail, password })
  });
}
async function sync(token, body) {
  const res = await fetch(base + '/api/sync', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('sync_http_' + res.status);
  return res.json();
}
const blank = () => ({ version: 1, records: {}, deleted: {} });
const assert = (value, message) => { if (!value) throw new Error(message); };

let pass = 0;
async function test(name, fn) {
  await fn(); pass++; console.log('  PASS  ' + name);
}

try {
  start(); await ready();
  console.log('== Cloud sync API integration ==\n');
  await test('first-run registration validates input and creates the private account', async () => {
    assert((await register('bad-email', accountPassword)).status === 400, 'invalid email was accepted');
    const res = await register(); assert(res.status === 201, 'first registration failed');
    const data = await res.json(); assert(data.token && data.email === accountEmail, 'registration response invalid');
  });
  await test('registration closes after the private account has been created', async () => {
    assert((await register('another@example.com', 'another-secure-password')).status === 409, 'second account was accepted');
  });
  await test('authentication rejects bad credentials and returns a signed token for the configured account', async () => {
    assert((await login('wrong-password')).status === 401, 'bad password was accepted');
    const res = await login(); assert(res.ok, 'valid login failed');
    const data = await res.json(); assert(data.token && data.email === accountEmail, 'token response invalid');
  });
  const auth = await (await login()).json();
  const token = auth.token;
  const baseTs = Date.now();
  const book = { id: 'id_sync_book_001', module: 'books', title: 'device A', createdAt: baseTs, updatedAt: baseTs };

  await test('device A upload is visible when device B syncs an empty local cache', async () => {
    const a = blank(); a.records.books = [book];
    await sync(token, a);
    const b = await sync(token, blank());
    assert(b.records.books.some(x => x.id === book.id && x.title === 'device A'), 'device B did not receive device A record');
  });
  await test('newer device B edit wins and returns to device A', async () => {
    const b = blank(); b.records.books = [{ ...book, title: 'device B edit', updatedAt: baseTs + 1000 }];
    await sync(token, b);
    const a = await sync(token, blank());
    assert(a.records.books.find(x => x.id === book.id).title === 'device B edit', 'newer edit did not merge');
  });
  await test('delete tombstone prevents an older device from resurrecting a record', async () => {
    const deletion = blank(); deletion.deleted.books = { [book.id]: baseTs + 2000 };
    await sync(token, deletion);
    const stale = blank(); stale.records.books = [{ ...book, title: 'stale offline copy', updatedAt: baseTs + 1000 }];
    const result = await sync(token, stale);
    assert(!result.records.books.some(x => x.id === book.id), 'deleted record was resurrected');
    assert(result.deleted.books[book.id] === baseTs + 2000, 'delete tombstone missing');
  });
  await test('binary file upload and authenticated cross-device download round-trip', async () => {
    const id = 'id_sync_file_001';
    const put = await fetch(base + '/api/files/' + id + '/original', {
      method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'audio/mpeg', 'X-File-Type': 'audio/mpeg', 'X-File-Name': 'sample.mp3' },
      body: Buffer.from('binary-audio-fixture')
    });
    assert(put.ok, 'file upload failed');
    const get = await fetch(base + '/api/files/' + id + '/original', { headers: { Authorization: 'Bearer ' + token } });
    assert(get.ok && await get.text() === 'binary-audio-fixture', 'file download mismatch');
  });
  await test('snapshot remains after server restart on the same persistent data directory', async () => {
    const life = blank(); life.records.life = [{ id: 'id_persist_001', module: 'life', title: 'persisted', createdAt: baseTs, updatedAt: baseTs }];
    await sync(token, life);
    child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve));
    start(); await ready();
    const nextToken = (await (await login()).json()).token;
    const result = await sync(nextToken, blank());
    assert(result.records.life.some(x => x.id === 'id_persist_001'), 'snapshot did not survive restart');
  });
  console.log(`\n结果：${pass} 通过 / 0 失败`);
} finally {
  if (child && !child.killed) child.kill('SIGTERM');
  rmSync(dataDir, { recursive: true, force: true });
}
