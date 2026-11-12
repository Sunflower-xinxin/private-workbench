/* =====================================================================
 * store.js — 私人工作台 · 本地优先数据层（localStorage + IndexedDB + cloud sync）
 * 设计原则：
 *  - 每模块独立命名空间 pw_records_<module>，模块间物理隔离
 *  - 每模块独立 FORMS 表单配置（禁止跨模块复用）
 *  - 全业务字段选填：任意一项有效内容即可保存；全空白不落库
 *  - 草稿独立键 pw_draft_<module>_<key>，异常退出可恢复
 *  - 图片/音频/附件走 IndexedDB，记录里只存稳定文件 ID
 *  - 登录后以 updatedAt + 删除墓碑与服务端合并，文件同步到服务端持久盘
 *  - seed() 幂等：已有数据绝不覆盖（安全迁移基线）
 * 同时兼容 Node（测试时注入 localStorage shim）
 * ===================================================================== */
(function (global) {
'use strict';

/* ---------- 本地存储访问（测试环境可注入 shim） ---------- */
function ls() {
  if (!global.localStorage) throw new Error('localStorage 不可用');
  return global.localStorage;
}
function read(key, fallback) {
  const raw = ls().getItem(key);
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}
function write(key, val) { ls().setItem(key, JSON.stringify(val)); }

const REC_KEY = m => 'pw_records_' + m;
const DRAFT_KEY = (m, k) => 'pw_draft_' + m + '_' + k;
const DELETED_KEY = m => 'pw_deleted_' + m;

function uid() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/* =====================================================================
 * 表单配置 FORMS —— 每个模块独立定义，禁止复用其他模块配置
 * 字段类型：text | textarea | select | seg | chips(单选) | tags |
 *           rating | date | images | checklist | link | switch | custom
 * ===================================================================== */
const FORMS = {
  books: {
    module: 'books', name: '书籍',
    fields: [
      { k: 'title',    label: '书名',   type: 'text' },
      { k: 'author',   label: '作者',   type: 'text' },
      { k: 'category', label: '类别',   type: 'select', options: ['文学', '心理', '设计', '技术', '其他'], custom: true },
      { k: 'excerpt',  label: '书摘',   type: 'textarea' },
      { k: 'tags',     label: '标签',   type: 'tags' },
      { k: 'fav',      label: '收藏',   type: 'switch' }
    ]
  },
  english: {
    module: 'english', name: '英语 · 词汇',
    fields: [
      { k: 'word',    label: '英文单词',   type: 'text' },
      { k: 'pos',     label: '词性',       type: 'select', options: ['n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'phr.'], custom: true },
      { k: 'meaning', label: '中文翻译',   type: 'text' },
      { k: 'example', label: '例句',       type: 'textarea' },
      { k: 'scene',   label: '应用场景',   type: 'text' },
      { k: 'tags',    label: '标签',       type: 'tags' }
    ]
  },
  english_listening: {
    module: 'english', name: '英语 · 听力', subtype: 'listening',
    fields: [
      { k: 'title',      label: '听力材料', type: 'text' },
      { k: 'audioLink',  label: '音频外部链接', type: 'link' },
      { k: 'files',      label: '音频文件', type: 'files', accept: 'audio/*' },
      { k: 'transcript', label: '听力文本', type: 'textarea' },
      { k: 'notes',      label: '学习笔记', type: 'textarea' }
    ]
  },
  english_speaking: {
    module: 'english', name: '英语 · 口语', subtype: 'speaking',
    fields: [
      { k: 'topic',  label: '口语话题', type: 'text' },
      { k: 'files',  label: '练习录音', type: 'files', accept: 'audio/*' },
      { k: 'record', label: '文字记录', type: 'textarea' },
      { k: 'notes',  label: '练习笔记', type: 'textarea' }
    ]
  },
  english_reading: {
    module: 'english', name: '英语 · 阅读', subtype: 'reading',
    fields: [
      { k: 'title',      label: '文章标题', type: 'text' },
      { k: 'link',       label: '文章链接', type: 'link' },
      { k: 'article',    label: '阅读文章', type: 'textarea' },
      { k: 'notes',      label: '阅读笔记', type: 'textarea' },
      { k: 'vocabulary', label: '生词及相关内容', type: 'textarea' },
      { k: 'files',      label: '附件', type: 'files', accept: 'image/*,.pdf,.txt' }
    ]
  },
  english_writing: {
    module: 'english', name: '英语 · 写作', subtype: 'writing',
    fields: [
      { k: 'prompt',   label: '写作题目', type: 'textarea' },
      { k: 'body',     label: '作文正文', type: 'textarea' },
      { k: 'versions', label: '修改版本', type: 'textarea' },
      { k: 'comments', label: '批注', type: 'textarea' },
      { k: 'notes',    label: '学习笔记', type: 'textarea' },
      { k: 'files',    label: '附件', type: 'files', accept: 'image/*,.pdf,.txt' }
    ]
  },
  movies: {
    module: 'movies', name: '电影',
    fields: [
      { k: 'title',    label: '电影名称', type: 'text' },
      { k: 'director', label: '导演',     type: 'text' },
      { k: 'genre',    label: '电影类型', type: 'select', options: ['剧情', '科幻', '纪录', '动画', '悬疑', '爱情', '其他'], custom: true },
      { k: 'year',     label: '上映年份', type: 'text' },
      { k: 'status',   label: '观看状态', type: 'seg', options: ['想看', '在看', '已看'] },
      { k: 'rating',   label: '评分',     type: 'rating' },
      { k: 'review',   label: '观后感',   type: 'textarea' },
      { k: 'tags',     label: '自定义标签', type: 'tags' }
    ]
  },
  outfit: {
    module: 'outfit', name: '穿搭 · 风格',
    fields: [
      { k: 'name',   label: '风格名称', type: 'text' },
      { k: 'images', label: '灵感图片', type: 'images' }
    ]
  },
  job: {
    module: 'job', name: '找工作',
    fields: [
      { k: 'tab',     label: '所属标签页', type: 'seg', options: ['简历', '作品集', '面试', '人际关系'] },
      { k: 'kind',    label: '类型', type: 'select', options: ['技巧', '资料', 'Skill', 'Prompt', '链接'], custom: true },
      { k: 'title',   label: '标题',   type: 'text' },
      { k: 'content', label: '内容',   type: 'textarea' },
      { k: 'link',    label: '链接',   type: 'link' },
      { k: 'images',  label: '附件图片', type: 'images' },
      { k: 'note',    label: '备注',   type: 'textarea' },
      { k: 'tags',    label: '标签',   type: 'tags' },
      { k: 'fav',     label: '收藏',   type: 'switch' },
      { k: 'pin',     label: '置顶',   type: 'switch' }
    ]
  },
  prompt: {
    module: 'prompt', name: 'Prompt & Skills',
    fields: [
      { k: 'ptype',    label: '类型',     type: 'seg', options: ['Prompt', 'Skill'] },
      { k: 'category', label: '分类',     type: 'select', options: ['写作', 'PPT', '设计', 'AI 工具', '视觉', '数据分析', '营销', '效率工具'], custom: true },
      { k: 'title',    label: '标题',     type: 'text' },
      { k: 'content',  label: '内容',     type: 'textarea' },
      { k: 'usage',    label: '使用说明', type: 'textarea' },
      { k: 'scene',    label: '适用场景', type: 'text' },
      { k: 'source',   label: '来源',     type: 'text' },
      { k: 'github',   label: 'GitHub 地址', type: 'link' },
      { k: 'link',     label: '其他链接', type: 'link' },
      { k: 'images',   label: '图片',     type: 'images' },
      { k: 'note',     label: '备注',     type: 'textarea' },
      { k: 'tags',     label: '标签',     type: 'tags' },
      { k: 'fav',      label: '收藏',     type: 'switch' },
      { k: 'pin',      label: '置顶',     type: 'switch' }
    ]
  },
  life: {
    module: 'life', name: '生活',
    fields: [
      { k: 'category', label: '分类', type: 'select', options: ['厨房', '数码', '健康', '家居', '其他'], custom: true },
      { k: 'title',    label: '标题', type: 'text' },
      { k: 'content',  label: '内容', type: 'textarea' },
      { k: 'link',     label: '链接', type: 'link' },
      { k: 'tolearn',  label: '标记为「待学」', type: 'switch' },
      { k: 'learned',  label: '已学会', type: 'switch' },
      { k: 'note',     label: '备注', type: 'textarea' },
      { k: 'tags',     label: '标签', type: 'tags' },
      { k: 'fav',      label: '收藏', type: 'switch' }
    ]
  },
  /* 旅行：两套独立表单，记录统一存 module=travel，以 ttype 区分 */
  travel_gone: {
    module: 'travel', name: '旅行 · 去过的地方', subtype: 'gone',
    fields: [
      { k: 'destination', label: '目的地',   type: 'text' },
      { k: 'date',        label: '旅行日期', type: 'text' },
      { k: 'images',      label: '旅行照片（数量不限）', type: 'images' },
      { k: 'note',        label: '文字记录', type: 'textarea' },
      { k: 'tags',        label: '标签',     type: 'tags' }
    ]
  },
  travel_want: {
    module: 'travel', name: '旅行 · 想去的地方', subtype: 'want',
    fields: [
      { k: 'destination', label: '目的地',   type: 'text' },
      { k: 'planTime',    label: '计划时间', type: 'text' },
      { k: 'budget',      label: '预算',     type: 'text' },
      { k: 'docs',        label: '所需证件', type: 'text' },
      { k: 'checklist',   label: '准备清单', type: 'checklist' },
      { k: 'note',        label: '备注',     type: 'textarea' },
      { k: 'tags',        label: '标签',     type: 'tags' }
    ]
  }
};

/* =====================================================================
 * 有效性校验：任意一项有效内容即可保存
 * 图片 / 标签 / 链接 / 评分 / 清单项目 均视为有效内容；
 * switch（收藏、置顶等）只是元数据，单独不构成有效内容。
 * ===================================================================== */
function fieldHas(f, v) {
  switch (f.type) {
    case 'images':
    case 'files':
    case 'tags':
      return Array.isArray(v) && v.length > 0;
    case 'checklist':
      return Array.isArray(v) && v.some(x => x && String(x.text || '').trim() !== '');
    case 'custom':
      return Array.isArray(v) && v.some(x => x && String(x.value || '').trim() !== '');
    case 'rating':
      return (Number(v) || 0) > 0;
    case 'switch':
      return false; // 元数据，不计入有效内容
    default:
      return v != null && String(v).trim() !== '';
  }
}
function hasContent(values, form) {
  return form.fields.some(f => fieldHas(f, values ? values[f.k] : undefined));
}

/* =====================================================================
 * 记录 CRUD（每模块独立命名空间）
 * ===================================================================== */
function list(m) {
  return read(REC_KEY(m), []);
}
function get(m, id) {
  return list(m).find(x => x.id === id) || null;
}
function save(m, values, formKey) {
  const form = FORMS[formKey || m];
  if (!form) return { ok: false, reason: 'unknown_form' };
  if (!hasContent(values, form)) return { ok: false, reason: 'empty' };
  const items = list(m);
  const nowTs = Date.now();
  let item;
  if (values.id) {
    const idx = items.findIndex(x => x.id === values.id);
    if (idx >= 0) {
      item = Object.assign({}, items[idx], values, { updatedAt: nowTs });
      items[idx] = item;
    } else {
      item = Object.assign({}, values, { id: values.id, createdAt: nowTs, updatedAt: nowTs });
      items.push(item);
    }
  } else {
    item = Object.assign({}, values, { id: uid(), createdAt: nowTs, updatedAt: nowTs });
    items.push(item);
  }
  if (form.subtype) {
    if (m === 'travel') item.ttype = form.subtype;
    else item.subtype = form.subtype;
  }
  item.module = m;
  write(REC_KEY(m), items);
  const deleted = read(DELETED_KEY(m), {});
  delete deleted[item.id];
  write(DELETED_KEY(m), deleted);
  clearDraft(m, values.__draftKey || (values.id || 'new'));
  cloud.schedule();
  return { ok: true, item };
}
function remove(m, id) {
  const items = list(m);
  const idx = items.findIndex(x => x.id === id);
  if (idx < 0) return null;
  const [removed] = items.splice(idx, 1);
  write(REC_KEY(m), items);
  const deleted = read(DELETED_KEY(m), {});
  deleted[id] = Date.now();
  write(DELETED_KEY(m), deleted);
  cloud.schedule();
  return removed;
}
function restore(m, item) {
  const items = list(m);
  const deleted = read(DELETED_KEY(m), {});
  const restored = Object.assign({}, item, { updatedAt: Math.max(Date.now(), (Number(deleted[item.id]) || 0) + 1) });
  if (!items.some(x => x.id === item.id)) {
    items.push(restored);
    write(REC_KEY(m), items);
  }
  delete deleted[item.id];
  write(DELETED_KEY(m), deleted);
  cloud.schedule();
  return restored;
}
/* 相册页专用：记录已存在时允许整体写回（例如仅照片的地点删光了照片，
 * hasContent 会拒绝空内容更新，但该地点记录本身必须保留，不能被丢掉） */
function putRaw(m, item) {
  const items = list(m);
  const out = Object.assign({}, item, { module: m, updatedAt: Date.now() });
  const idx = items.findIndex(x => x.id === item.id);
  if (idx >= 0) items[idx] = out; else items.push(out);
  write(REC_KEY(m), items);
  const deleted = read(DELETED_KEY(m), {});
  delete deleted[item.id];
  write(DELETED_KEY(m), deleted);
  cloud.schedule();
  return out;
}

/* ---------- 草稿 ---------- */
function setDraft(m, key, values) {
  write(DRAFT_KEY(m, key), { values, ts: Date.now() });
}
function getDraft(m, key) {
  return read(DRAFT_KEY(m, key), null);
}
function clearDraft(m, key) {
  try { ls().removeItem(DRAFT_KEY(m, key)); } catch (e) {}
}

/* =====================================================================
 * 导出 / 导入（版本化备份，导入不触碰备份中不存在的模块）
 * ===================================================================== */
const BACKUP_VERSION = 2;
function moduleKeys() {
  return ['books', 'english', 'movies', 'outfit', 'job', 'prompt', 'life', 'travel'];
}
function exportAll() {
  const data = {};
  moduleKeys().forEach(m => { data[m] = list(m); });
  return JSON.stringify({ version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data });
}
function importAll(json) {
  let parsed;
  try { parsed = JSON.parse(json); } catch (e) { throw new Error('备份文件损坏：不是合法 JSON'); }
  if (!parsed || typeof parsed !== 'object' || ![1, BACKUP_VERSION].includes(parsed.version) || typeof parsed.data !== 'object') {
    throw new Error('备份文件损坏或版本不兼容');
  }
  let count = 0, modules = 0;
  Object.keys(parsed.data).forEach(m => {
    if (!moduleKeys().includes(m)) return;
    if (!Array.isArray(parsed.data[m])) throw new Error('备份数据格式错误：' + m);
    const nowTs = Date.now();
    const incoming = parsed.data[m].map(item => Object.assign({}, item, { module: m, updatedAt: nowTs }));
    const incomingIds = new Set(incoming.map(item => item.id));
    const deleted = read(DELETED_KEY(m), {});
    list(m).forEach(item => { if (!incomingIds.has(item.id)) deleted[item.id] = nowTs; });
    incoming.forEach(item => { delete deleted[item.id]; });
    write(REC_KEY(m), incoming); write(DELETED_KEY(m), deleted);
    count += incoming.length; modules++;
  });
  cloud.schedule();
  return { modules, records: count };
}

/* =====================================================================
 * 种子数据（幂等：已有数据的模块绝不覆盖 → 迁移安全基线）
 * ===================================================================== */
const SEED = {
  books: [
    { title: '夜晚的潜水艇', author: '陈春成', category: '文学', excerpt: '「我的火焰，在十六岁那年就熄灭了，我余生所成就的所谓事业，不过是火焰熄灭后升起的几缕青烟罢了。」', tags: ['文学', '书摘'], fav: true },
    { title: '思考，快与慢', author: '丹尼尔·卡尼曼', category: '心理', excerpt: '系统 1 快思考、系统 2 慢思考。标注了 23 条书摘。', tags: ['心理'], fav: false },
    { title: '设计中的设计', author: '原研哉', category: '设计', excerpt: '再设计——把日常物品陌生化。', tags: ['设计'], fav: true }
  ],
  english: [
    { word: 'ubiquitous', pos: 'adj.', meaning: '无处不在的', example: 'Smartphones are ubiquitous in modern life.', scene: '写作 Task 2 · 科技类', tags: ['待复习'] },
    { word: 'meticulous', pos: 'adj.', meaning: '一丝不苟的', example: 'She kept meticulous notes.', scene: '口语 Part 2 · 人物描述', tags: ['已掌握'] },
    { word: 'deteriorate', pos: 'v.', meaning: '恶化', example: 'The situation deteriorated rapidly.', scene: '听力 Section 4 · 错题 ×2', tags: ['错题'] }
  ],
  movies: [
    { title: '燃烧女子的肖像', director: '瑟琳·席安玛', genre: '剧情', year: '2019', status: '已看', rating: 5, review: '「当你注视着画中人，我又注视着谁？」', tags: ['收藏'] },
    { title: '完美的日子', director: '维姆·文德斯', genre: '剧情', year: '2023', status: '想看', rating: 0, review: '', tags: ['豆瓣 8.4'] },
    { title: '沙丘 2', director: '丹尼斯·维伦纽瓦', genre: '科幻', year: '2024', status: '已看', rating: 4, review: '视听奇观，值得二刷 IMAX。', tags: [] }
  ],
  outfit: [
    { name: 'Clean Fit', images: [] },
    { name: 'Vintage', images: [] },
    { name: 'Minimalism', images: [] },
    { name: 'Old Money', images: [] }
  ],
  job: [
    { tab: '简历', kind: '资料', title: '简历 v3.2 · 通用版', content: 'STAR 法则改写项目经历；附 HR 反馈批注。', tags: ['技巧'], fav: true, pin: true },
    { tab: '面试', kind: '技巧', title: '行为面试 20 题清单', content: '「最大的失败」还需打磨故事线。', tags: [], fav: true },
    { tab: '人际关系', kind: '资料', title: '内推联系人 · 学姐 A', content: '11月5日 约了咖啡，提到下季度有 HC。', tags: ['内推'], pin: true }
  ],
  prompt: [
    { ptype: 'Prompt', category: '效率工具', title: '周报生成器', content: '输入本周要点 → 输出结构化周报。', usage: '粘贴要点列表即可', source: '自建', tags: ['置顶'], pin: true, fav: true },
    { ptype: 'Prompt', category: '写作', title: '论文降重改写', content: '学术风格改写，保留原意。', github: 'github.com/awesome-prompts', tags: [], fav: true },
    { ptype: 'Skill', category: 'PPT', title: 'workbuddy-pptx 技能', content: '从大纲直接生成演示文稿。', tags: [] }
  ],
  life: [
    { category: '厨房', title: '冷冻米饭再加热更松软的方法', content: '表面撒一点水，盖保鲜膜中火 90 秒。', tags: [], fav: true },
    { category: '其他', title: '视频剪辑（剪映）', content: '目标：能剪 3 分钟 vlog。', tolearn: true, learned: false, tags: ['待学'], pin: true }
  ],
  travel: [
    { ttype: 'gone', destination: '大理 · 洱海', date: '10月2日–10月6日', note: '环海骑行 30km，日落绝佳。', tags: ['云南'] },
    { ttype: 'want', destination: '新疆 · 喀纳斯', planTime: '明年 9–10 月', budget: '¥6000', docs: '身份证', checklist: [{ text: '订机票', done: false }, { text: '查秋色最佳时间', done: true }], note: '', tags: [] }
  ]
};

/* One-time, recoverable schema migration.
 * Removed modules and legacy text-first outfit records are archived locally
 * before their active keys are changed. The archive is included neither in UI
 * nor cloud sync, but can be copied from DevTools if rollback is ever needed. */
function migrate() {
  if (read('pw_schema_version', 1) >= 2) return false;
  const removed = {};
  ['notes', 'period'].forEach(m => {
    const records = read(REC_KEY(m), null);
    if (Array.isArray(records) && records.length) removed[m] = records;
    try { ls().removeItem(REC_KEY(m)); ls().removeItem(DELETED_KEY(m)); } catch (_) {}
  });
  if (Object.keys(removed).length) {
    write('pw_removed_modules_backup_v2', { archivedAt: new Date().toISOString(), data: removed });
  }

  const oldOutfit = read(REC_KEY('outfit'), null);
  if (Array.isArray(oldOutfit) && oldOutfit.some(x => !x.name && (x.style || x.otype || x.top || x.note))) {
    write('pw_outfit_legacy_backup_v2', { archivedAt: new Date().toISOString(), data: oldOutfit });
    const grouped = new Map();
    oldOutfit.forEach(item => {
      const name = String(item.style || '未分类').trim() || '未分类';
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name).push(...(Array.isArray(item.images) ? item.images : []));
    });
    const nowTs = Date.now();
    write(REC_KEY('outfit'), Array.from(grouped.entries()).map(([name, images], index) => ({
      id: uid(), module: 'outfit', name, images: Array.from(new Set(images)), order: index,
      createdAt: nowTs, updatedAt: nowTs
    })));
  }
  write('pw_schema_version', 2);
  return true;
}

function seed() {
  let seeded = 0;
  Object.keys(SEED).forEach(m => {
    if (ls().getItem(REC_KEY(m)) == null) {          // 幂等：已有数据绝不覆盖
      const nowTs = Date.now();
      write(REC_KEY(m), SEED[m].map((x, i) => Object.assign({
        id: uid() + i, module: m, createdAt: nowTs - (i + 1) * 86400000, updatedAt: nowTs - (i + 1) * 3600000
      }, x)));
      seeded++;
    }
  });
  return seeded;
}

/* =====================================================================
 * Binary assets: local IndexedDB cache + authenticated cloud copy.
 * ===================================================================== */
const assetDB = {
  _db: null,
  available() { return typeof global.indexedDB !== 'undefined'; },
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const req = global.indexedDB.open('pw-photos', 2);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      };
      req.onsuccess = e => { this._db = e.target.result; res(this._db); };
      req.onerror = e => rej(e.target.error);
    });
  },
  async action(storeName, mode, method, value) {
    const db = await this.open();
    const os = db.transaction(storeName, mode).objectStore(storeName);
    return new Promise((res, rej) => {
      const req = os[method](value);
      req.onsuccess = () => res(req.result || null);
      req.onerror = e => rej(e.target.error);
    });
  }
};

const photos = {
  available: () => assetDB.available(),
  async add(ownerKey, file) {
    const blob = await downscale(file, 1920, 0.88);
    const thumb = await downscale(file, 480, 0.8);
    const rec = { id: uid(), ownerKey, blob, thumb, type: 'image/jpeg', name: file.name || '', ts: Date.now() };
    await assetDB.action('photos', 'readwrite', 'put', rec);
    cloud.queueAsset(rec.id, 'photo');
    if (cloud.signedIn()) cloud.flushAssets().catch(() => {});
    return rec.id;
  },
  async get(id) {
    const local = await assetDB.action('photos', 'readonly', 'get', id);
    if (local) return local;
    if (!cloud.signedIn()) return null;
    const [blob, thumb] = await Promise.all([
      cloud.fetchFile(id, 'original'), cloud.fetchFile(id, 'thumb').catch(() => null)
    ]);
    if (!blob) return null;
    const rec = { id, ownerKey: 'cloud', blob, thumb: thumb || blob, type: blob.type, name: '', ts: Date.now() };
    await assetDB.action('photos', 'readwrite', 'put', rec);
    return rec;
  },
  async remove(id) {
    await assetDB.action('photos', 'readwrite', 'delete', id);
    cloud.unqueueAsset(id);
    if (cloud.signedIn()) await cloud.deleteFile(id).catch(() => {});
  },
  async removeMany(ids) { for (const id of (ids || [])) { try { await this.remove(id); } catch (_) {} } }
};

const files = {
  available: () => assetDB.available(),
  async add(ownerKey, file) {
    const id = uid();
    const rec = { id, ownerKey, blob: file, type: file.type || 'application/octet-stream', name: file.name || '附件', size: file.size || 0, ts: Date.now() };
    await assetDB.action('files', 'readwrite', 'put', rec);
    cloud.queueAsset(id, 'file');
    if (cloud.signedIn()) cloud.flushAssets().catch(() => {});
    return { id, name: rec.name, type: rec.type, size: rec.size };
  },
  async get(ref) {
    const id = typeof ref === 'string' ? ref : ref && ref.id;
    if (!id) return null;
    const local = await assetDB.action('files', 'readonly', 'get', id);
    if (local) return local;
    if (!cloud.signedIn()) return null;
    const blob = await cloud.fetchFile(id, 'original');
    const rec = { id, ownerKey: 'cloud', blob, type: (ref && ref.type) || blob.type, name: (ref && ref.name) || '附件', size: (ref && ref.size) || blob.size, ts: Date.now() };
    await assetDB.action('files', 'readwrite', 'put', rec);
    return rec;
  },
  async remove(ref) {
    const id = typeof ref === 'string' ? ref : ref && ref.id;
    if (!id) return;
    await assetDB.action('files', 'readwrite', 'delete', id);
    cloud.unqueueAsset(id);
    if (cloud.signedIn()) await cloud.deleteFile(id).catch(() => {});
  },
  async removeMany(refs) { for (const ref of (refs || [])) { try { await this.remove(ref); } catch (_) {} } }
};
function downscale(file, maxSide, quality) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      const scale = Math.min(1, maxSide / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error('图片处理失败')), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('图片读取失败')); };
    img.src = url;
  });
}

/* =====================================================================
 * Cloud sync. localStorage remains the offline cache; the server is the
 * cross-device source of truth after merge. Deletes use tombstones so an old
 * device cannot resurrect a record that another device deleted.
 * ===================================================================== */
const cloud = {
  timer: null,
  syncing: false,
  lastError: '',
  apiBase() { return String((global.WORKBENCH_CONFIG && global.WORKBENCH_CONFIG.apiBase) || '').replace(/\/$/, ''); },
  token() { return read('pw_cloud_token', ''); },
  email() { return read('pw_cloud_email', ''); },
  signedIn() { return !!this.token(); },
  status() { return { signedIn: this.signedIn(), email: this.email(), syncing: this.syncing, lastError: this.lastError, lastSyncAt: read('pw_last_sync_at', 0) }; },
  emit() {
    if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
      global.dispatchEvent(new CustomEvent('pw-sync', { detail: this.status() }));
    }
  },
  async request(pathname, options) {
    if (typeof global.fetch !== 'function') throw new Error('fetch_unavailable');
    const headers = Object.assign({}, options && options.headers);
    if (this.token()) headers.Authorization = 'Bearer ' + this.token();
    const res = await global.fetch(this.apiBase() + pathname, Object.assign({}, options || {}, { headers }));
    if (res.status === 401) { this.logout(); throw new Error('login_expired'); }
    if (!res.ok) {
      let reason = 'http_' + res.status;
      try { reason = (await res.json()).error || reason; } catch (_) {}
      throw new Error(reason);
    }
    return res;
  },
  async login(email, password) {
    const res = await this.request('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    write('pw_cloud_token', data.token); write('pw_cloud_email', data.email);
    this.lastError = ''; this.emit();
    await this.queueReferencedAssets();
    await this.syncNow();
    return data;
  },
  logout() {
    try { ls().removeItem('pw_cloud_token'); ls().removeItem('pw_cloud_email'); } catch (_) {}
    this.syncing = false; this.emit();
  },
  schedule() {
    if (!this.signedIn()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.syncNow().catch(() => {}), 700);
  },
  snapshot() {
    const records = {}, deleted = {};
    moduleKeys().forEach(m => { records[m] = list(m); deleted[m] = read(DELETED_KEY(m), {}); });
    return { version: 1, records, deleted };
  },
  queueAsset(id, kind) {
    if (!id) return;
    const pending = read('pw_pending_assets', []);
    if (!pending.some(x => x.id === id)) { pending.push({ id, kind }); write('pw_pending_assets', pending); }
  },
  unqueueAsset(id) {
    write('pw_pending_assets', read('pw_pending_assets', []).filter(x => x.id !== id));
  },
  async queueReferencedAssets() {
    moduleKeys().forEach(m => list(m).forEach(item => {
      (item.images || []).forEach(id => this.queueAsset(id, 'photo'));
      if (item.coverPhotoId) this.queueAsset(item.coverPhotoId, 'photo');
      (item.files || []).forEach(ref => this.queueAsset(typeof ref === 'string' ? ref : ref.id, 'file'));
    }));
  },
  async flushAssets() {
    if (!this.signedIn() || !assetDB.available()) return;
    const pending = read('pw_pending_assets', []).slice();
    for (const task of pending) {
      try {
        if (task.kind === 'photo') {
          const rec = await assetDB.action('photos', 'readonly', 'get', task.id);
          if (!rec) { this.unqueueAsset(task.id); continue; }
          await Promise.all([
            this.uploadFile(task.id, 'original', rec.blob, rec.name),
            this.uploadFile(task.id, 'thumb', rec.thumb || rec.blob, rec.name)
          ]);
        } else {
          const rec = await assetDB.action('files', 'readonly', 'get', task.id);
          if (!rec) { this.unqueueAsset(task.id); continue; }
          await this.uploadFile(task.id, 'original', rec.blob, rec.name);
        }
        this.unqueueAsset(task.id);
      } catch (_) { /* keep task for the next online/sync attempt */ }
    }
  },
  async syncNow() {
    if (!this.signedIn() || this.syncing) return null;
    this.syncing = true; this.lastError = ''; this.emit();
    try {
      await this.flushAssets();
      const res = await this.request('/api/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.snapshot())
      });
      const remote = await res.json();
      moduleKeys().forEach(m => {
        if (remote.records && Array.isArray(remote.records[m])) write(REC_KEY(m), remote.records[m]);
        if (remote.deleted && remote.deleted[m]) write(DELETED_KEY(m), remote.deleted[m]);
      });
      write('pw_last_sync_at', Date.now());
      return remote;
    } catch (e) {
      this.lastError = e.message || '同步失败'; throw e;
    } finally { this.syncing = false; this.emit(); }
  },
  async uploadFile(id, variant, blob, name) {
    return this.request('/api/files/' + encodeURIComponent(id) + '/' + variant, {
      method: 'PUT', headers: { 'Content-Type': blob.type || 'application/octet-stream', 'X-File-Type': blob.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(name || '') }, body: blob
    });
  },
  async fetchFile(id, variant) {
    const res = await this.request('/api/files/' + encodeURIComponent(id) + '/' + variant);
    return res.blob();
  },
  async deleteFile(id) { return this.request('/api/files/' + encodeURIComponent(id), { method: 'DELETE' }); },
  async init() { if (this.signedIn()) return this.syncNow().catch(() => null); return null; }
};

/* ---------- 导出 ---------- */
const store = {
  FORMS, moduleKeys, hasContent, fieldHas,
  list, get, save, remove, restore, putRaw,
  setDraft, getDraft, clearDraft,
  exportAll, importAll, migrate, seed, photos, files, cloud,
  _uid: uid
};
global.PWStore = store;
if (typeof module !== 'undefined' && module.exports) module.exports = store;

})(typeof globalThis !== 'undefined' ? globalThis : this);
