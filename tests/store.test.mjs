/* =====================================================================
 * store.test.mjs — 私人工作台数据层验收测试（Node 运行，真实记录结果）
 * 运行：node tests/store.test.mjs
 * 覆盖用户验收标准 ①–⑩ 中可在数据层自动验证的部分
 * ===================================================================== */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));

/* ---------- localStorage shim（模拟浏览器环境） ---------- */
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

/* 加载 store.js（UMD，挂到 globalThis.PWStore） */
const code = readFileSync(join(__dir, '..', 'store.js'), 'utf8');
new Function(code)();
const S = globalThis.PWStore;
S.migrate();
S.seed(); // 模拟 App 启动初始化（幂等）

/* ---------- 测试框架 ---------- */
let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log('  PASS  ' + name); }
  catch (e) { fail++; failures.push(name + ' -> ' + e.message); console.log('  FAIL  ' + name + '  ->  ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' 期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a)); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

console.log('== 私人工作台 · 数据层验收测试 ==\n');

/* ---------- A. 表单配置独立性（根因验证） ---------- */
console.log('[A] 表单配置独立性与完整性');
t('A1 每个模块拥有独立 FORMS 配置（无跨模块复用）', () => {
  const keys = Object.keys(S.FORMS);
  ok(keys.length >= 13, '应包含 8 个现役空间及英语/旅行子表单，实际 ' + keys.length);
  ['books', 'english', 'english_listening', 'english_speaking', 'english_reading', 'english_writing', 'movies', 'outfit', 'job', 'prompt', 'life', 'travel_gone', 'travel_want']
    .forEach(k => ok(S.FORMS[k], '缺少表单配置: ' + k));
  ok(!S.FORMS.notes && !S.FORMS.period, '随笔/经期表单应已移除');
});
t('A2 英语表单≠书籍表单，且含 单词/词性/翻译/例句/场景', () => {
  const en = S.FORMS.english.fields.map(f => f.k);
  const bk = S.FORMS.books.fields.map(f => f.k);
  ok(JSON.stringify(en) !== JSON.stringify(bk), '英语与书籍表单配置相同（复用 bug 未修复）');
  ['word', 'pos', 'meaning', 'example', 'scene'].forEach(k => ok(en.includes(k), '英语表单缺少字段 ' + k));
  ok(!en.includes('excerpt'), '英语表单不应包含书摘字段 excerpt');
  ok(!en.includes('author'), '英语表单不应包含作者字段 author');
});
t('A3 电影表单含 名称/导演/类型/年份/状态/评分/观后感/标签', () => {
  const mv = S.FORMS.movies.fields.map(f => f.k);
  ['title', 'director', 'genre', 'year', 'status', 'rating', 'review', 'tags'].forEach(k => ok(mv.includes(k), '电影表单缺少 ' + k));
  eq(S.FORMS.movies.fields.find(f => f.k === 'status').options.join(','), '想看,在看,已看', '观看状态选项');
  eq(S.FORMS.movies.fields.find(f => f.k === 'rating').type, 'rating', '评分字段类型');
});
t('A4 穿搭表单是图片优先的风格 Moodboard', () => {
  const of = S.FORMS.outfit.fields.map(f => f.k);
  eq(of.join(','), 'name,images', '穿搭不应保留文字搭配表单');
});
t('A5 英语听说读写使用四套独立业务表单', () => {
  const expected = {
    english_listening: ['title', 'audioLink', 'files', 'transcript', 'notes'],
    english_speaking: ['topic', 'files', 'record', 'notes'],
    english_reading: ['title', 'link', 'article', 'notes', 'vocabulary', 'files'],
    english_writing: ['prompt', 'body', 'versions', 'comments', 'notes', 'files']
  };
  Object.entries(expected).forEach(([key, fields]) => eq(S.FORMS[key].fields.map(f => f.k).join(','), fields.join(','), key));
});
t('A6 旅行拥有两套独立表单（去过/想去），字段互不混用', () => {
  const gone = S.FORMS.travel_gone.fields.map(f => f.k);
  const want = S.FORMS.travel_want.fields.map(f => f.k);
  ['destination', 'date', 'images', 'note'].forEach(k => ok(gone.includes(k), '去过表单缺少 ' + k));
  ['destination', 'planTime', 'budget', 'docs', 'checklist', 'note'].forEach(k => ok(want.includes(k), '想去表单缺少 ' + k));
  ok(!gone.includes('checklist'), '去过表单不应含准备清单');
  ok(!gone.includes('budget'), '去过表单不应含预算');
  ok(!want.includes('images'), '想去表单不应含照片字段');
  ok(!want.includes('date'), '想去表单不应含旅行日期字段');
  eq(S.FORMS.travel_gone.module, 'travel', '去过表单归属模块');
  eq(S.FORMS.travel_want.module, 'travel', '想去表单归属模块');
});

/* ---------- B. 保存规则（验收 ①②③） ---------- */
console.log('\n[B] 保存规则');
t('B1 英语：仅填单词一个字段即可保存', () => {
  const r = S.save('english', { word: 'serendipity' });
  ok(r.ok, '仅填 word 保存失败');
  ok(r.item.id, '未生成 ID');
  ok(r.item.createdAt && r.item.updatedAt, '缺少时间戳');
});
t('B2 电影：仅填评分（无标题）也可保存', () => {
  const r = S.save('movies', { rating: 4 });
  ok(r.ok, '仅评分保存失败');
});
t('B3 穿搭：仅上传图片即可保存', () => {
  const r = S.save('outfit', { images: ['photo_fake_1', 'photo_fake_2'] });
  ok(r.ok, '仅图片保存失败');
});
t('B4 旅行(想去)：仅添加一个清单项目即可保存', () => {
  const r = S.save('travel', { checklist: [{ text: '办签证', done: false }] }, 'travel_want');
  ok(r.ok, '仅清单保存失败');
  eq(r.item.ttype, 'want', '想去记录应标记 ttype=want');
});
t('B5 旅行(去过)：仅填目的地即可保存，且 ttype=gone', () => {
  const r = S.save('travel', { destination: '京都' }, 'travel_gone');
  ok(r.ok, '保存失败');
  eq(r.item.ttype, 'gone', '去过记录应标记 ttype=gone');
});
t('B6 完全空白的表单不创建记录（全部模块逐一验证）', () => {
  const cases = [
    ['books', {}, 'books'], ['english', {}, 'english'], ['movies', {}, 'movies'],
    ['outfit', {}, 'outfit'], ['job', {}, 'job'], ['prompt', {}, 'prompt'],
    ['life', {}, 'life'], ['english', {}, 'english_listening'], ['english', {}, 'english_speaking'],
    ['english', {}, 'english_reading'], ['english', {}, 'english_writing'],
    ['travel', {}, 'travel_gone'], ['travel', {}, 'travel_want']
  ];
  cases.forEach(([m, v, fk]) => {
    const before = S.list(m).length;
    const r = S.save(m, v, fk);
    ok(!r.ok && r.reason === 'empty', m + ' 空白表单竟被保存');
    eq(S.list(m).length, before, m + ' 空白保存产生了记录');
  });
});
t('B7 仅勾选收藏开关不算有效内容（元数据不计入）', () => {
  const r = S.save('books', { fav: true });
  ok(!r.ok, '仅收藏开关不应构成有效内容');
});
t('B8 仅填标签可保存（标签是有效内容）', () => {
  const r = S.save('life', { tags: ['冷门知识'] });
  ok(r.ok, '仅标签保存失败');
});

/* ---------- C. 回显与编辑（验收 ⑤⑥） ---------- */
console.log('\n[C] 回显与编辑');
t('C1 保存后重新读取，全部字段完整回显', () => {
  const input = { word: 'meticulous', pos: 'adj.', meaning: '一丝不苟的', example: 'She is meticulous.', scene: '口语 Part 2', tags: ['重点'] };
  const r = S.save('english', input);
  ok(r.ok, '保存失败');
  const got = S.get('english', r.item.id);
  ['word', 'pos', 'meaning', 'example', 'scene'].forEach(k => eq(got[k], input[k], '字段 ' + k + ' 回显不一致'));
  eq(got.tags[0], '重点', '标签回显不一致');
});
t('C2 编辑后正确保存：createdAt 不变、updatedAt 更新、其他字段保留', () => {
  const r = S.save('movies', { title: '测试片', director: '某导演' });
  const id = r.item.id, created = r.item.createdAt;
  const r2 = S.save('movies', { id, title: '测试片（改）', rating: 5 });
  ok(r2.ok, '编辑保存失败');
  const got = S.get('movies', id);
  eq(got.title, '测试片（改）', '标题未更新');
  eq(got.director, '某导演', '未编辑的字段被丢失');
  eq(got.rating, 5, '新增字段未写入');
  eq(got.createdAt, created, 'createdAt 被改动');
  ok(got.updatedAt >= got.createdAt, 'updatedAt 异常');
});
t('C3 穿搭图片顺序调整后正确持久化', () => {
  const r = S.save('outfit', { images: ['p1', 'p2', 'p3'], name: 'Minimalism' });
  const arr = S.get('outfit', r.item.id).images;
  [arr[0], arr[1]] = [arr[1], arr[0]];
  S.save('outfit', { id: r.item.id, images: arr });
  eq(S.get('outfit', r.item.id).images.join(','), 'p2,p1,p3', '图片顺序未保存');
});

/* ---------- D. 删除与隔离（验收 ⑦⑨） ---------- */
console.log('\n[D] 删除与模块隔离');
t('D1 删除正常且可撤销恢复', () => {
  const r = S.save('life', { content: '待删除的生活记录' });
  const removed = S.remove('life', r.item.id);
  ok(removed, '删除未返回被删记录');
  eq(S.get('life', r.item.id), null, '删除后仍可读取');
  S.restore('life', removed);
  ok(S.get('life', r.item.id), '撤销恢复失败');
});
t('D2 删除一个模块的记录不影响其他模块', () => {
  const rb = S.save('books', { title: '隔离测试书' });
  const re = S.save('english', { word: 'isolation' });
  const nB = S.list('books').length, nE = S.list('english').length;
  S.remove('books', rb.item.id);
  eq(S.list('english').length, nE, '删除书籍影响了英语模块');
  eq(S.list('books').length, nB - 1, '书籍模块数量异常');
  S.remove('english', re.item.id);
});
t('D3 各模块数据完全隔离存储（独立命名空间）', () => {
  const keys = [];
  for (let i = 0; i < 80; i++) keys.push('pw_records_' + S.moduleKeys()[i % 8]);
  const uniq = new Set(keys);
  eq(uniq.size, 8, '模块命名空间不独立');
  S.moduleKeys().forEach(m => ok(localStorage.getItem('pw_records_' + m) !== null, m + ' 缺少独立存储'));
});
t('D4 旅行两套表单写入同一模块但以 ttype 正确区分', () => {
  const g = S.save('travel', { destination: '隔离·去过' }, 'travel_gone');
  const w = S.save('travel', { destination: '隔离·想去', budget: '¥1' }, 'travel_want');
  eq(S.get('travel', g.item.id).ttype, 'gone', '去过记录 ttype 错误');
  eq(S.get('travel', w.item.id).ttype, 'want', '想去记录 ttype 错误');
  ok(!('budget' in S.get('travel', g.item.id)) || !S.get('travel', g.item.id).budget, '去过记录混入预算字段');
});

/* ---------- E. 草稿（验收 ④⑧） ---------- */
console.log('\n[E] 草稿自动保存与恢复');
t('E1 草稿写入/读取/清除', () => {
  S.setDraft('english', 'new_', { word: 'draftword' });
  const d = S.getDraft('english', 'new_');
  ok(d && d.values.word === 'draftword', '草稿未正确保存');
  ok(d.ts > 0, '草稿缺少时间戳');
  S.clearDraft('english', 'new_');
  eq(S.getDraft('english', 'new_'), null, '草稿清除失败');
});
t('E2 保存成功后自动清除对应草稿', () => {
  S.setDraft('movies', 'new_', { title: '草稿电影' });
  const r = S.save('movies', { title: '草稿电影', __draftKey: 'new_' });
  ok(r.ok, '保存失败');
  eq(S.getDraft('movies', 'new_'), null, '保存后草稿未清除');
});
t('E3 草稿与正式记录互不影响（未保存的草稿不出现在列表）', () => {
  const n = S.list('books').length;
  S.setDraft('books', 'new_', { title: '未保存草稿书' });
  eq(S.list('books').length, n, '草稿污染了正式列表');
  S.clearDraft('books', 'new_');
});

/* ---------- F. 持久化与迁移安全（验收 ⑦⑧） ---------- */
console.log('\n[F] 持久化与迁移');
t('F1 seed() 幂等：已有数据绝不覆盖（模拟 App 更新）', () => {
  const r = S.save('books', { title: '更新前的珍贵数据' });
  const before = S.list('books').length;
  S.seed(); // 模拟应用更新后再次初始化
  eq(S.list('books').length, before, 'seed 覆盖或丢失了已有数据');
  ok(S.get('books', r.item.id), '已有记录在 seed 后丢失');
});
t('F2 重新加载 store（模拟退出重进）数据不丢失', () => {
  const r = S.save('life', { title: '持久化验证', content: '重启后应仍存在' });
  // 模拟重新加载：store 直接从 localStorage 读，重新调用 list 即可
  const got = S.list('life').find(x => x.id === r.item.id);
  ok(got && got.title === '持久化验证' && got.content === '重启后应仍存在', '重进后数据丢失');
});
t('F3 导出 v2 备份包含全部 8 个现役模块', () => {
  const parsed = JSON.parse(S.exportAll());
  eq(parsed.version, 2, '备份缺少版本号');
  eq(Object.keys(parsed.data).length, 8, '备份未覆盖全部现役模块');
});
t('F4 导入损坏备份：报错且不写入任何数据', () => {
  const before = JSON.stringify(S.list('books'));
  let threw = false;
  try { S.importAll('{corrupted json!!!'); } catch (e) { threw = true; }
  ok(threw, '损坏备份未报错');
  eq(JSON.stringify(S.list('books')), before, '损坏备份污染了数据');
  let threw2 = false;
  try { S.importAll('{"version":99,"data":{}}'); } catch (e) { threw2 = true; }
  ok(threw2, '版本不兼容的备份未报错');
  const beforeAtomic = JSON.stringify(S.list('books'));
  let threw3 = false;
  try { S.importAll(JSON.stringify({ version: 2, data: { books: [{ id: 'should_not_write', title: '不应写入' }], life: 'invalid' } })); } catch (e) { threw3 = true; }
  ok(threw3, '部分损坏的备份未报错');
  eq(JSON.stringify(S.list('books')), beforeAtomic, '校验失败前已部分覆盖记录');
});
t('F5 导入合法备份：恢复数据且不影响备份外模块', () => {
  const rb = S.save('books', { title: '备份恢复测试书' });
  const backup = S.exportAll();
  S.remove('books', rb.item.id);
  eq(S.get('books', rb.item.id), null, '删除失败');
  const lifeCount = S.list('life').length;
  const r = S.importAll(backup);
  ok(S.get('books', rb.item.id), '备份恢复失败');
  eq(S.list('life').length, lifeCount, '导入影响了其他模块');
});
t('F6 v2 导入兼容旧 v1 JSON，且忽略已移除模块', () => {
  const old = JSON.stringify({ version: 1, data: { books: [{ id: 'old_book', title: '旧备份书' }], notes: [{ id: 'old_note', content: '不再导入' }] } });
  const result = S.importAll(old);
  eq(result.modules, 1, '应只导入现役模块');
  ok(S.get('books', 'old_book'), 'v1 书籍未导入');
  eq(S.list('notes').length, 0, '已移除随笔不应恢复到活跃数据');
});

/* ---------- G. 四模块重点场景（验收 重点） ---------- */
console.log('\n[G] 英语/电影/穿搭/旅行重点场景');
t('G1 英语：仅填应用场景可保存；后续可补充编辑', () => {
  const r = S.save('english', { scene: '写作 Task 2' });
  ok(r.ok, '仅场景保存失败');
  const r2 = S.save('english', { id: r.item.id, word: 'subsequently', meaning: '随后' });
  ok(r2.ok, '补充编辑失败');
  eq(S.get('english', r.item.id).scene, '写作 Task 2', '原字段在编辑后丢失');
});
t('G2 电影：仅填观看状态可保存；状态值限定在枚举内', () => {
  const r = S.save('movies', { status: '在看' });
  ok(r.ok, '仅状态保存失败');
  ok(['想看', '在看', '已看'].includes(S.get('movies', r.item.id).status), '状态值异常');
});
t('G3 穿搭：风格名称与图片数组独立保存', () => {
  const r = S.save('outfit', { name: 'Old Money', images: ['look_1'] });
  ok(r.ok, '风格保存失败');
  eq(S.get('outfit', r.item.id).images[0], 'look_1', '图片关联回显错误');
});
t('G4 英语四项可部分填写并以 subtype 隔离', () => {
  const a = S.save('english', { transcript: '只填听力文本' }, 'english_listening');
  const b = S.save('english', { topic: 'Part 2' }, 'english_speaking');
  const c = S.save('english', { vocabulary: 'ubiquitous' }, 'english_reading');
  const d = S.save('english', { comments: '逻辑链待加强' }, 'english_writing');
  [a, b, c, d].forEach(x => ok(x.ok, '部分字段保存失败'));
  eq([a.item.subtype, b.item.subtype, c.item.subtype, d.item.subtype].join(','), 'listening,speaking,reading,writing', '子模块归属错误');
});
t('G5 旅行(想去)：清单勾选状态持久化', () => {
  const r = S.save('travel', { checklist: [{ text: '订机票', done: false }, { text: '办签证', done: true }] }, 'travel_want');
  const got = S.get('travel', r.item.id);
  eq(got.checklist.filter(x => x.done).length, 1, '清单勾选状态错误');
  const cl = got.checklist; cl[0].done = true;
  S.save('travel', { id: r.item.id, checklist: cl }, 'travel_want');
  eq(S.get('travel', r.item.id).checklist.filter(x => x.done).length, 2, '清单更新失败');
});
t('G6 空清单项（纯空白文本）不算有效内容', () => {
  const r = S.save('travel', { checklist: [{ text: '   ', done: false }] }, 'travel_want');
  ok(!r.ok, '空白清单项不应构成有效内容');
});

/* ---------- 汇总 ---------- */
console.log('\n========================================');
console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败（共 ' + (pass + fail) + ' 项）');
if (failures.length) { console.log('\n失败明细：'); failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('全部通过。');
