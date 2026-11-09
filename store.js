/* =====================================================================
 * store.js — 私人工作台 · 数据层（浏览器 localStorage + IndexedDB）
 * 设计原则：
 *  - 每模块独立命名空间 pw_records_<module>，模块间物理隔离
 *  - 每模块独立 FORMS 表单配置（禁止跨模块复用）
 *  - 全业务字段选填：任意一项有效内容即可保存；全空白不落库
 *  - 草稿独立键 pw_draft_<module>_<key>，异常退出可恢复
 *  - 图片走 IndexedDB（Blob），记录里只存 photoId，禁止 Base64 入库
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
    module: 'outfit', name: '穿搭',
    fields: [
      { k: 'otype',       label: '记录类型', type: 'seg', options: ['服饰单品', '完整搭配'] },
      { k: 'style',       label: '风格分类', type: 'select', options: ['极简通勤', '日系休闲', '周末出游', '运动', '正式'], custom: true },
      { k: 'top',         label: '上衣',     type: 'text' },
      { k: 'bottom',      label: '下装',     type: 'text' },
      { k: 'shoes',       label: '鞋子',     type: 'text' },
      { k: 'accessories', label: '配饰',     type: 'text' },
      { k: 'occasion',    label: '适用场合', type: 'text' },
      { k: 'images',      label: '图片',     type: 'images' },
      { k: 'link',        label: '链接',     type: 'link' },
      { k: 'custom',      label: '自定义字段', type: 'custom' },
      { k: 'note',        label: '备注',     type: 'textarea' },
      { k: 'tags',        label: '标签',     type: 'tags' }
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
  notes: {
    module: 'notes', name: '随笔',
    fields: [
      { k: 'mood',    label: '心情标签', type: 'chips', options: ['平静', '开心', '疲惫', '期待', '低落'] },
      { k: 'content', label: '正文',     type: 'textarea' },
      { k: 'images',  label: '图片',     type: 'images' }
    ]
  },
  period: {
    module: 'period', name: '经期',
    fields: [
      { k: 'start', label: '开始日期', type: 'date' },
      { k: 'end',   label: '结束日期（进行中可留空）', type: 'date' },
      { k: 'note',  label: '备注', type: 'textarea' }
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
  if (form.subtype) item.ttype = form.subtype;
  item.module = m;
  write(REC_KEY(m), items);
  clearDraft(m, values.__draftKey || (values.id || 'new'));
  return { ok: true, item };
}
function remove(m, id) {
  const items = list(m);
  const idx = items.findIndex(x => x.id === id);
  if (idx < 0) return null;
  const [removed] = items.splice(idx, 1);
  write(REC_KEY(m), items);
  return removed;
}
function restore(m, item) {
  const items = list(m);
  if (!items.some(x => x.id === item.id)) {
    items.push(item);
    write(REC_KEY(m), items);
  }
  return item;
}
/* 相册页专用：记录已存在时允许整体写回（例如仅照片的地点删光了照片，
 * hasContent 会拒绝空内容更新，但该地点记录本身必须保留，不能被丢掉） */
function putRaw(m, item) {
  const items = list(m);
  const out = Object.assign({}, item, { module: m, updatedAt: Date.now() });
  const idx = items.findIndex(x => x.id === item.id);
  if (idx >= 0) items[idx] = out; else items.push(out);
  write(REC_KEY(m), items);
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
const BACKUP_VERSION = 1;
function moduleKeys() {
  return ['books', 'english', 'movies', 'outfit', 'job', 'prompt', 'life', 'notes', 'period', 'travel'];
}
function exportAll() {
  const data = {};
  moduleKeys().forEach(m => { data[m] = list(m); });
  return JSON.stringify({ version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data });
}
function importAll(json) {
  let parsed;
  try { parsed = JSON.parse(json); } catch (e) { throw new Error('备份文件损坏：不是合法 JSON'); }
  if (!parsed || typeof parsed !== 'object' || parsed.version !== BACKUP_VERSION || typeof parsed.data !== 'object') {
    throw new Error('备份文件损坏或版本不兼容');
  }
  let count = 0;
  Object.keys(parsed.data).forEach(m => {
    if (!moduleKeys().includes(m)) return;
    if (!Array.isArray(parsed.data[m])) throw new Error('备份数据格式错误：' + m);
    write(REC_KEY(m), parsed.data[m]);
    count += parsed.data[m].length;
  });
  return { modules: Object.keys(parsed.data).length, records: count };
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
    { otype: '完整搭配', style: '极简通勤', top: '白色衬衫', bottom: '黑色直筒裤', shoes: '乐福鞋', accessories: '银色手表', occasion: '办公室', note: '周一例会标配', tags: ['通勤'] },
    { otype: '服饰单品', style: '日系休闲', top: 'oversize 卫衣', occasion: '周末', link: '', note: '参考图待补', tags: ['参考'] }
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
  notes: [
    { mood: '平静', content: '11 月的第一个周五，雨。把书桌收拾了一遍，翻到去年在云南写的明信片。' },
    { mood: '开心', content: '面试复盘：表现比预期好，面试官对作品集里那个工具项目很感兴趣。' }
  ],
  period: [
    { start: '2026-10-06', end: '2026-10-10' },
    { start: '2026-11-04', end: '' }
  ],
  travel: [
    { ttype: 'gone', destination: '大理 · 洱海', date: '10月2日–10月6日', note: '环海骑行 30km，日落绝佳。', tags: ['云南'] },
    { ttype: 'want', destination: '新疆 · 喀纳斯', planTime: '明年 9–10 月', budget: '¥6000', docs: '身份证', checklist: [{ text: '订机票', done: false }, { text: '查秋色最佳时间', done: true }], note: '', tags: [] }
  ]
};

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
 * 图片层（IndexedDB，仅浏览器；Node 测试环境自动禁用）
 * ===================================================================== */
const photos = {
  _db: null,
  available() { return typeof global.indexedDB !== 'undefined'; },
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const req = global.indexedDB.open('pw-photos', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'id' });
        }
      };
      req.onsuccess = e => { this._db = e.target.result; res(this._db); };
      req.onerror = e => rej(e.target.error);
    });
  },
  _tx(mode) { return this.open().then(db => db.transaction('photos', mode).objectStore('photos')); },
  async add(ownerKey, file) {
    const blob = await downscale(file, 1280, 0.85);
    const thumb = await downscale(file, 360, 0.8);
    const rec = { id: uid(), ownerKey, blob, thumb, ts: Date.now() };
    const os = await this._tx('readwrite');
    return new Promise((res, rej) => { const r = os.put(rec); r.onsuccess = () => res(rec.id); r.onerror = e => rej(e.target.error); });
  },
  async get(id) {
    const os = await this._tx('readonly');
    return new Promise((res, rej) => { const r = os.get(id); r.onsuccess = () => res(r.result || null); r.onerror = e => rej(e.target.error); });
  },
  async remove(id) {
    const os = await this._tx('readwrite');
    return new Promise((res, rej) => { const r = os.delete(id); r.onsuccess = () => res(); r.onerror = e => rej(e.target.error); });
  },
  async removeMany(ids) { for (const id of (ids || [])) { try { await this.remove(id); } catch (e) {} } }
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

/* ---------- 导出 ---------- */
const store = {
  FORMS, moduleKeys, hasContent, fieldHas,
  list, get, save, remove, restore, putRaw,
  setDraft, getDraft, clearDraft,
  exportAll, importAll, seed, photos,
  _uid: uid
};
global.PWStore = store;
if (typeof module !== 'undefined' && module.exports) module.exports = store;

})(typeof globalThis !== 'undefined' ? globalThis : this);
