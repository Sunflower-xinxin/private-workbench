/* =====================================================================
 * album.test.mjs — 旅行相册数据层验收测试（Node 运行）
 * 运行：node tests/album.test.mjs
 * 覆盖：地点间照片隔离、多选删除只动当前地点、批量导入关联、
 *       仅照片地点删光照片后记录保留、持久化。
 * 图片 Blob 层（IndexedDB）由 tests/album.visual.html 在浏览器中验收。
 * ===================================================================== */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));

function makeLS() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    clear: () => map.clear(),
    get size() { return map.size; }
  };
}
globalThis.localStorage = makeLS();

const code = readFileSync(join(__dir, '..', 'store.js'), 'utf8');
new Function(code)();
const S = globalThis.PWStore;
S.seed();

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log('  PASS  ' + name); }
  catch (e) { fail++; failures.push(name + ' -> ' + e.message); console.log('  FAIL  ' + name + '  ->  ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' 期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a)); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

console.log('== 旅行相册 · 数据层验收测试 ==\n');

/* ---------- H. 相册核心：照片归属与隔离 ---------- */
console.log('[H] 地点间照片集合隔离');
t('H1 两个地点各自持有独立的 images 集合', () => {
  const A = S.save('travel', { destination: '地点A', date: '10月' }, 'travel_gone').item;
  const B = S.save('travel', { destination: '地点B', date: '11月' }, 'travel_gone').item;
  // 模拟批量导入：pids 只追加到 A
  const A2 = S.get('travel', A.id);
  A2.images = ['pa1', 'pa2', 'pa3'];
  S.save('travel', Object.assign({}, A2), 'travel_gone');
  const B2 = S.get('travel', B.id);
  B2.images = ['pb1'];
  S.save('travel', Object.assign({}, B2), 'travel_gone');
  eq(S.get('travel', A.id).images.join(','), 'pa1,pa2,pa3', '地点A照片集合错误');
  eq(S.get('travel', B.id).images.join(','), 'pb1', '地点B照片集合错误');
});
t('H2 多选删除只影响当前地点（albumDeleteSel 的数据逻辑）', () => {
  const A = S.list('travel').find(x => x.destination === '地点A');
  const B = S.list('travel').find(x => x.destination === '地点B');
  const sel = new Set(['pa1', 'pa3']);                    // 模拟勾选 2 张
  const rec = S.get('travel', A.id);
  rec.images = rec.images.filter(pid => !sel.has(pid));   // albumDeleteSel 同款过滤
  S.save('travel', Object.assign({}, rec), 'travel_gone');
  eq(S.get('travel', A.id).images.join(','), 'pa2', '当前地点删除后照片错误');
  eq(S.get('travel', B.id).images.join(','), 'pb1', '删除影响了其他地点');
});
t('H3 批量导入只追加到当前地点', () => {
  const A = S.list('travel').find(x => x.destination === '地点A');
  const B = S.list('travel').find(x => x.destination === '地点B');
  const rec = S.get('travel', A.id);
  rec.images = rec.images.concat(['pa4', 'pa5']);         // albumAddPhotos 同款追加
  S.save('travel', Object.assign({}, rec), 'travel_gone');
  eq(S.get('travel', A.id).images.length, 3, '地点A数量错误');
  eq(S.get('travel', B.id).images.length, 1, '导入影响了其他地点');
});
t('H4 photoId 全局唯一，不会跨地点串照片', () => {
  const all = S.list('travel').filter(x => (x.ttype || 'gone') === 'gone')
    .flatMap(x => x.images || []);
  eq(new Set(all).size, all.length, '存在重复 photoId');
});

/* ---------- I. putRaw 与边界 ---------- */
console.log('\n[I] putRaw 边界（persistTravelAlbum 兜底路径）');
t('I1 仅照片的地点删光照片：记录保留、images 为空、无幽灵照片', () => {
  const r = S.save('travel', { images: ['px1', 'px2'] }, 'travel_gone');  // 仅照片即可成记录
  ok(r.ok && r.item.id, '仅照片记录创建失败');
  const rec = S.get('travel', r.item.id);
  rec.images = rec.images.filter(() => false);            // 全删
  const sr = S.save('travel', Object.assign({}, rec), 'travel_gone');
  ok(!sr.ok && sr.reason === 'empty', '全空内容应被 save 拒绝（走 putRaw 兜底）');
  const kept = S.putRaw('travel', rec);                   // persistTravelAlbum 的兜底
  ok(kept && kept.id === rec.id, 'putRaw 未保留记录');
  eq(S.get('travel', rec.id).images.length, 0, '删光后应无照片');
});
t('I2 putRaw 保留 id/createdAt/module，更新 updatedAt', () => {
  const r = S.save('travel', { destination: 'putRaw测试' }, 'travel_gone').item;
  const rec = S.get('travel', r.id);
  const out = S.putRaw('travel', Object.assign({}, rec, { note: '改备注' }));
  eq(out.id, r.id, 'id 变了');
  eq(out.createdAt, r.createdAt, 'createdAt 被改动');
  eq(out.module, 'travel', 'module 错误');
  ok(out.updatedAt >= r.updatedAt, 'updatedAt 未更新');
  eq(S.get('travel', r.id).note, '改备注', '字段未写回');
});
t('I3 putRaw 不影响其他地点记录', () => {
  const A = S.list('travel').find(x => x.destination === '地点A');
  const B = S.list('travel').find(x => x.destination === '地点B');
  S.putRaw('travel', Object.assign({}, S.get('travel', A.id), { note: 'A的备注' }));
  eq(S.get('travel', B.id).note || '', '', 'putRaw 影响了其他地点');
  eq(S.get('travel', B.id).images.length, 1, 'putRaw 影响了其他地点照片');
});

/* ---------- J. 持久化（模拟重启） ---------- */
console.log('\n[J] 持久化');
t('J1 模拟重启（重新加载 store.js）：照片关联与记录完整保留', () => {
  const before = S.list('travel').map(x => ({ id: x.id, images: (x.images || []).slice() }));
  // 重新加载一遍 store.js（共享同一 localStorage）
  new Function(code)();
  const S2 = globalThis.PWStore;
  const after = S2.list('travel').map(x => ({ id: x.id, images: (x.images || []).slice() }));
  eq(JSON.stringify(after), JSON.stringify(before), '重启后数据不一致');
});
t('J2 seed 幂等：相册照片不会被种子数据覆盖', () => {
  const A = S.list('travel').find(x => x.destination === '地点A');
  const n = A.images.length;
  S.seed();
  eq(S.get('travel', A.id).images.length, n, 'seed 覆盖了照片关联');
});

console.log('\n========================================');
console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败（共 ' + (pass + fail) + ' 项）');
if (failures.length) { console.log('\n失败明细：'); failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('全部通过。');
