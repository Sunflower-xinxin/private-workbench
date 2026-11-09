/* =====================================================================
 * app.js — 私人工作台 · UI 层
 * 关键修复：编辑器不再使用通用表单，而是严格按模块从 PWStore.FORMS
 * 取配置渲染；新增/编辑共享同一配置，保证回显一致、数据归属正确。
 * ===================================================================== */
'use strict';
const S = window.PWStore;

/* ---------- 图标与模块元数据 ---------- */
const ICONS = {
  book:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  english:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
  movies:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>',
  outfit:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3L4 7l2.5 2.5L8 8v13h8V8l1.5 1.5L20 7l-5-4a3 3 0 0 1-6 0z"/></svg>',
  job:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7M3 12h18"/></svg>',
  prompt:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/></svg>',
  life:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z"/></svg>',
  notes:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  period:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/><circle cx="12" cy="15.5" r="2.2" fill="currentColor" stroke="none"/></svg>',
  travel:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5c1.8-1.8 1.8-3-1-1L15 10 6.2 8.2l1.5-1.5a10 10 0 0 1 7.8-2.9l3.2-2.1a2.6 2.6 0 0 1 3.6 3.6l-2.1 3.2a10 10 0 0 1-2.9 7.8l.5 2.9z" transform="scale(.85) translate(2,2)"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V10.5z"/></svg>',
  grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/></svg>',
  plus:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  back:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  search:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  pin:'<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M15 2l-5 9 2 1-3 10 8-11-3-1 4-8z"/></svg>',
  chev:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  check:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5.5 5.5L20 6.5"/></svg>',
  cam:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  lock:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  close:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  pencil:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  imgdel:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>'
};
const MODULES = [
  { id:'books',   name:'书籍',            en:'收纳 · 书摘',     c:'#7C8DB0' },
  { id:'english', name:'英语',            en:'雅思备考',        c:'#6FA8A0' },
  { id:'movies',  name:'电影',            en:'收藏 · 想看',     c:'#B08A8A' },
  { id:'outfit',  name:'穿搭',            en:'风格 · 搭配',     c:'#9E8FBF' },
  { id:'job',     name:'找工作',          en:'求职工作台',      c:'#8FA3BF' },
  { id:'prompt',  name:'Prompt & Skills', en:'提示词 · 技能',   c:'#B49A5E' },
  { id:'life',    name:'生活',            en:'技巧 · 冷知识',   c:'#7FA37A' },
  { id:'notes',   name:'随笔',            en:'沉浸记录',        c:'#B0A090' },
  { id:'period',  name:'经期',            en:'周期记录',        c:'#C48A9A' },
  { id:'travel',  name:'旅行',            en:'足迹 · 心愿',     c:'#7C9EB0' }
];
const M = id => MODULES.find(m => m.id === id);
const iconOf = id => id;

/* ---------- 通用工具 ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return '刚刚';
  if (d < 3600000) return Math.floor(d / 60000) + ' 分钟前';
  if (d < 86400000) return Math.floor(d / 3600000) + ' 小时前';
  if (d < 2 * 86400000) return '昨天';
  return Math.floor(d / 86400000) + ' 天前';
}
function titleOf(m, v) {
  switch (m) {
    case 'books': return v.title || '（无书名）';
    case 'english': return v.word || '（无单词）';
    case 'movies': return v.title || '（无片名）';
    case 'outfit': return [v.style, v.top || v.bottom || v.shoes].filter(Boolean).join(' · ') || '（未命名搭配）';
    case 'job': case 'prompt': case 'life': return v.title || '（无标题）';
    case 'notes': return (v.content || '').slice(0, 24) || '（空白随笔）';
    case 'period': return '经期 ' + (v.start || '');
    case 'travel': return v.destination || '（无目的地）';
    default: return '（无标题）';
  }
}
function metaOf(m, v) {
  switch (m) {
    case 'books': return [v.author, v.category].filter(Boolean).join(' · ');
    case 'english': return [v.pos, v.meaning].filter(Boolean).join(' ');
    case 'movies': return [v.director, v.genre, v.year, v.status].filter(Boolean).join(' · ');
    case 'outfit': return [v.otype, v.occasion].filter(Boolean).join(' · ');
    case 'job': return [v.tab, v.kind].filter(Boolean).join(' · ');
    case 'prompt': return [v.ptype, v.category].filter(Boolean).join(' · ');
    case 'life': return [v.category, v.tolearn ? (v.learned ? '待学·已学会' : '待学') : ''].filter(Boolean).join(' · ');
    case 'notes': return v.mood || '';
    case 'period': return v.end ? v.start + ' ~ ' + v.end : v.start + ' 起（进行中）';
    case 'travel': return v.ttype === 'want' ? [v.planTime, v.budget].filter(Boolean).join(' · ') : (v.date || '');
    default: return '';
  }
}
function descOf(m, v) {
  switch (m) {
    case 'books': return v.excerpt;
    case 'english': return v.example;
    case 'movies': return v.rating ? '★'.repeat(v.rating) + (v.review ? ' ' + v.review : '') : v.review;
    case 'outfit': return [v.top && '上:' + v.top, v.bottom && '下:' + v.bottom, v.shoes && '鞋:' + v.shoes, v.accessories && '饰:' + v.accessories].filter(Boolean).join(' ') || v.note;
    case 'job': case 'prompt': case 'life': return v.content || v.note;
    case 'notes': return v.content;
    case 'travel': return v.ttype === 'want'
      ? [v.docs && '证件:' + v.docs, (v.checklist || []).length ? '清单 ' + (v.checklist.filter(x => x.done).length) + '/' + v.checklist.length : ''].filter(Boolean).join(' · ')
      : v.note;
    default: return '';
  }
}
function sortedItems(m) {
  return S.list(m).slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.updatedAt - a.updatedAt);
}
function allRecent(limit) {
  const out = [];
  S.moduleKeys().forEach(m => S.list(m).forEach(v => out.push({ m, v })));
  return out.sort((a, b) => b.v.updatedAt - a.v.updatedAt).slice(0, limit || 20);
}
/* 跳转目标：旅行「去过」直达相册页，其余进编辑器 */
function recHref(m, v) {
  if (m === 'travel') return (v.ttype || 'gone') === 'gone' ? '/album/' + v.id : '/edit/travel/' + v.id + '/want';
  return '/edit/' + m + '/' + v.id;
}

/* ---------- 路由 ---------- */
const view = document.getElementById('view'), tabbar = document.getElementById('tabbar');
function go(h) { location.hash = h; }
window.addEventListener('hashchange', render);
function tabs(on) {
  tabbar.innerHTML = [['home', '首页', 'home'], ['modules', '全部模块', 'grid'], ['recent', '最近使用', 'clock'], ['settings', '设置', 'gear']]
    .map(t => `<div class="tab ${on === t[0] ? 'on' : ''}" onclick="go('/${t[0] === 'home' ? '' : t[0]}')">${ICONS[t[2]]}<span>${t[1]}</span></div>`).join('');
}
function head(title, back, right) {
  return `<div class="navhead">${back ? `<div class="navback" onclick="go('${back}')">${ICONS.back}<span>返回</span></div>` : '<div style="width:60px"></div>'}<div class="navtitle">${title}</div><div class="navright">${right || ''}</div></div>`;
}

/* ---------- 全局 UI 状态 ---------- */
const ui = { q: '', chip: {}, modEdit: false, enTab: '词汇', jobTab: '简历', pType: 'Prompt', pCat: '全部', trTab: 'gone', noteView: 'tl' };

function render() {
  const parts = (location.hash || '#/').slice(1).split('/').filter(Boolean);
  const r = parts[0] || 'home';
  clearToast(); closeSheet(); closeViewer();
  const oldBar = document.getElementById('abar'); if (oldBar) oldBar.remove();
  if (r === 'home') { tabs('home'); view.innerHTML = pgHome(); }
  else if (r === 'modules') { tabs('modules'); view.innerHTML = pgModules(); }
  else if (r === 'recent') { tabs('recent'); view.innerHTML = pgRecent(); }
  else if (r === 'settings') { tabs('settings'); view.innerHTML = pgSettings(); }
  else if (r === 'album') { tabs(''); view.innerHTML = pgAlbum(parts[1]); afterAlbumRender(); }
  else if (r === 'm') {
    tabs('');
    const id = parts[1];
    if (id === 'english') view.innerHTML = pgEnglish();
    else if (id === 'job') view.innerHTML = pgJob();
    else if (id === 'prompt') view.innerHTML = pgPrompt();
    else if (id === 'notes') view.innerHTML = pgNotes();
    else if (id === 'period') view.innerHTML = pgPeriod();
    else if (id === 'travel') view.innerHTML = pgTravel();
    else view.innerHTML = pgModule(id);
  }
  else if (r === 'edit') { tabs(''); view.innerHTML = pgEdit(parts[1], parts[2], parts[3]); afterEditRender(); }
  else if (r === 'ocr') { tabs(''); view.innerHTML = pgOCR(parts[1]); }
  else { tabs('home'); view.innerHTML = pgHome(); }
  view.scrollTop = 0;
  const c = document.getElementById('clock');
  if (c) { const n = new Date(); c.textContent = n.getHours() + ':' + String(n.getMinutes()).padStart(2, '0'); }
}

/* =====================================================================
 * 首页（数据驱动）
 * ===================================================================== */
function pgHome() {
  const d = new Date(), wd = '日一二三四五六'[d.getDay()];
  const reading = S.list('books').slice().sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const words = S.list('english').filter(w => (w.tags || []).some(t => t.includes('待复习') || t.includes('错题')));
  const want = S.list('movies').filter(x => x.status === '想看')[0];
  const trip = S.list('travel').filter(x => x.ttype === 'gone').sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const recent = allRecent(3);
  const est = periodEstimate();
  return `<div class="page">
  <div class="hello"><div class="h-date">${d.getMonth() + 1}月${d.getDate()}日 · 星期${wd}</div><div class="h-title">你好</div></div>
  <div class="quickrec"><input id="qr" placeholder="快速记录：此刻的想法、链接、待办……" onkeydown="if(event.key==='Enter')quickSave()"><span class="q-btn" onclick="quickSave()">记录</span></div>
  <div class="sec-h"><h3>常用模块</h3><span onclick="go('/modules')">全部</span></div>
  <div class="modrow">${['books', 'english', 'notes', 'prompt', 'job'].map(id => { const m = M(id); return `<div class="modcell" onclick="go('/m/${id}')"><div class="modico" style="background:${m.c}">${ICONS[iconOf(id)]}</div><small>${m.name}</small></div>`; }).join('')}</div>
  <div class="sec-h"><h3>学习任务</h3><span onclick="go('/m/english')">英语</span></div>
  <div class="hcard" onclick="go('/m/english')"><div class="hthumb" style="background:#6FA8A0">IELTS</div><div class="hc-main"><div class="hc-t">雅思 12 月冲刺计划</div><div class="hc-s">词汇库 ${S.list('english').length} 词 · 今日：听力 ×2 · 词汇 30</div><div class="pbar"><i style="width:62%;background:#6FA8A0"></i></div></div></div>
  ${words.length ? `<div class="sec-h"><h3>待复习词汇</h3><span onclick="go('/m/english')">全部</span></div>
  <div class="group">${words.slice(0, 3).map(w => `<div class="row" onclick="go('/m/english')"><div class="r-main"><div class="r-title">${esc(w.word)}</div><div class="r-sub">${esc([w.pos, w.meaning].filter(Boolean).join(' '))}</div></div><span class="chev">${ICONS.chev}</span></div>`).join('')}</div>` : ''}
  ${reading ? `<div class="sec-h"><h3>正在阅读</h3><span onclick="go('/m/books')">书架</span></div>
  <div class="hcard" onclick="go('/m/books')"><div class="hthumb" style="background:#7C8DB0">${esc((reading.title || '').slice(0, 4))}</div><div class="hc-main"><div class="hc-t">${esc(reading.title)}</div><div class="hc-s">${esc(reading.author || '')} · ${timeAgo(reading.updatedAt)}更新</div></div></div>` : ''}
  ${want ? `<div class="sec-h"><h3>想看</h3><span onclick="go('/m/movies')">片单</span></div>
  <div class="hcard" onclick="go('/m/movies')"><div class="hthumb" style="background:#B08A8A">${esc((want.title || '').slice(0, 4))}</div><div class="hc-main"><div class="hc-t">${esc(want.title)}</div><div class="hc-s">${esc([want.director, want.year].filter(Boolean).join(' · '))} · 想看</div></div></div>` : ''}
  ${trip ? `<div class="sec-h"><h3>近期旅行</h3><span onclick="go('/m/travel')">足迹</span></div>
  <div class="hcard" onclick="go('/album/${trip.id}')"><div class="hthumb" style="background:linear-gradient(135deg,#A8C8D8,#7C9EB0)">${esc((trip.destination || '').slice(0, 2))}</div><div class="hc-main"><div class="hc-t">${esc(trip.destination)}</div><div class="hc-s">${esc(trip.date || '')} · 照片 ${(trip.images || []).length} 张</div></div></div>` : ''}
  ${est ? `<div class="sec-h"><h3>经期预测 <span class="lockpill">${ICONS.lock} 已单独加锁</span></h3><span onclick="go('/m/period')">详情</span></div>
  <div class="hcard" onclick="go('/m/period')"><div class="hthumb" style="background:#C48A9A;height:46px;width:46px;border-radius:50%">估</div><div class="hc-main"><div class="hc-t">预计 ${esc(est.next)} 前后（估算）</div><div class="hc-s">平均周期 ${est.avg} 天 · 仅供个人参考，非医学建议</div></div></div>` : ''}
  <div class="sec-h"><h3>最近编辑</h3><span onclick="go('/recent')">全部</span></div>
  <div class="group">${recent.map(r => `<div class="row" onclick="go('/m/${r.m}')"><div class="r-main"><div class="r-title" style="font-size:15px">${esc(titleOf(r.m, r.v))}</div><div class="r-sub">${M(r.m).name} · ${timeAgo(r.v.updatedAt)}</div></div><span class="chev">${ICONS.chev}</span></div>`).join('')}</div>
  </div>`;
}
function quickSave() {
  const i = document.getElementById('qr');
  if (i && i.value.trim()) {
    const r = S.save('notes', { content: i.value.trim(), mood: '' });
    if (r.ok) { toast('已保存到随笔', '查看', () => go('/m/notes')); i.value = ''; }
  } else toast('请输入内容后再记录');
}

/* =====================================================================
 * 全部模块
 * ===================================================================== */
function pgModules() {
  return `<div class="page ${ui.modEdit ? 'editmode' : ''}">
  ${head('全部模块', '', `<button class="iconbtn" onclick="ui.modEdit=!ui.modEdit;render()">${ui.modEdit ? '<b style="font-size:13px;color:var(--blue)">完成</b>' : ICONS.gear}</button>`)}
  <div class="largetitle">全部模块</div>
  <p class="sub" style="margin-bottom:16px">${ui.modEdit ? '点卡片固定到首页 · 长按可排序（演示）' : '10 个私人空间，数据只存在这台手机上'}</p>
  <div class="grid2">${MODULES.map(m => {
    const n = S.list(m.id).length;
    return `<div class="mcard" onclick="openModule('${m.id}')">
    <div class="mc-ico" style="background:${m.c}">${ICONS[iconOf(m.id)]}</div><h4>${m.name}</h4><p>${m.en} · ${n} 条</p></div>`;
  }).join('')}</div></div>`;
}
function openModule(id) { if (ui.modEdit) { toast('已固定「' + M(id).name + '」到首页'); return; } go('/m/' + id); }

/* =====================================================================
 * 最近使用（数据驱动）
 * ===================================================================== */
function pgRecent() {
  const all = allRecent(30);
  const today = [], yest = [], earlier = [];
  const day = 86400000, nowTs = Date.now();
  all.forEach(r => { const d = nowTs - r.v.updatedAt; (d < day ? today : d < 2 * day ? yest : earlier).push(r); });
  const grp = (name, arr) => arr.length ? `<div class="tl-date">${name}</div><div class="group">${arr.map(r => `
    <div class="row" onclick="go('${recHref(r.m, r.v)}')">
    <div class="modico" style="width:36px;height:36px;border-radius:10px;background:${M(r.m).c};flex:none">${ICONS[iconOf(r.m)]}</div>
    <div class="r-main"><div class="r-title" style="font-size:15px">${esc(titleOf(r.m, r.v))}</div><div class="r-sub">${M(r.m).name} · ${timeAgo(r.v.updatedAt)}</div></div>
    <span class="chev">${ICONS.chev}</span></div>`).join('')}</div>` : '';
  return `<div class="page">${head('最近使用')}<div class="largetitle">最近使用</div>
  ${all.length ? grp('今天', today) + grp('昨天', yest) + grp('更早', earlier)
    : `<div class="empty"><div class="e-ico">${ICONS.clock}</div><p>还没有任何记录</p></div>`}</div>`;
}

/* =====================================================================
 * 通用模块列表（书籍 / 电影 / 穿搭 / 生活）
 * ===================================================================== */
const CHIPS = {
  books: items => ['全部', ...new Set(items.map(x => x.category).filter(Boolean)), '收藏'],
  movies: () => ['全部', '想看', '在看', '已看', '收藏'],
  outfit: items => ['全部', ...new Set(items.map(x => x.style).filter(Boolean))],
  life: items => ['全部', ...new Set(items.map(x => x.category).filter(Boolean)), '待学']
};
function chipMatch(m, chip, v) {
  if (chip === '全部') return true;
  if (chip === '收藏') return !!v.fav;
  if (m === 'movies') return v.status === chip;
  if (m === 'life' && chip === '待学') return !!v.tolearn;
  if (m === 'books') return v.category === chip;
  if (m === 'outfit') return v.style === chip;
  if (m === 'life') return v.category === chip;
  return true;
}
function pgModule(id) {
  const m = M(id);
  const q = ui.q || '', chip = ui.chip[id] || '全部';
  const all = sortedItems(id);
  const list = all.filter(v => chipMatch(id, chip, v) && (!q || JSON.stringify(v).includes(q)));
  return `<div class="page">
  ${head(m.name, '/modules', `<button class="iconbtn" onclick="toast('排序：置顶优先 · 按更新时间')">${ICONS.gear}</button>`)}
  <div class="largetitle">${m.name}</div>
  <div class="searchbar">${ICONS.search}<input placeholder="搜索${m.name}…" value="${esc(q)}" oninput="ui.q=this.value;refreshList('${id}')"></div>
  <div class="chipline">${CHIPS[id](all).map(c => `<div class="chip ${c === chip ? 'on' : ''}" onclick="ui.chip['${id}']='${c}';render()">${c}</div>`).join('')}<div class="chip" onclick="toast('可在新增页直接输入自定义分类')">＋ 分类</div></div>
  <div id="listwrap">${listHtml(id, list)}</div>
  <button class="fab" onclick="go('/edit/${id}/new')">${ICONS.plus}</button></div>`;
}
function refreshList(id) {
  const chip = ui.chip[id] || '全部', q = ui.q || '';
  const list = sortedItems(id).filter(v => chipMatch(id, chip, v) && (!q || JSON.stringify(v).includes(q)));
  document.getElementById('listwrap').innerHTML = listHtml(id, list);
}
function listHtml(m, list) {
  if (!list.length) return `<div class="empty"><div class="e-ico">${ICONS[iconOf(m)]}</div><p>这里还空着<br>点右下角 + 创建第一条</p></div>`;
  return `<div class="group">${list.map(v => `<div class="item" onclick="go('/edit/${m}/${v.id}')">
    <div class="i-main"><div class="i-t">${v.pin ? '<span class="pindot"></span>' : ''}${esc(titleOf(m, v))} ${v.fav ? '<span class="starx">★</span>' : ''}</div>
    <div class="i-m">${esc(metaOf(m, v))}${descOf(m, v) ? '<br>' + esc(descOf(m, v)) : ''}</div>
    ${(v.tags || []).length ? `<div class="i-tags">${v.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}</div>
    <span class="chev">${ICONS.chev}</span></div>`).join('')}</div>`;
}

/* =====================================================================
 * 英语
 * ===================================================================== */
function pgEnglish() {
  const tabs = ['词汇', '听力', '口语', '阅读', '写作', '学习计划', '模考复盘'];
  let body = '';
  if (ui.enTab === '词汇') {
    const list = sortedItems('english');
    body = list.length
      ? `<div class="group">${list.map(w => `<div class="row" onclick="go('/edit/english/${w.id}')"><div class="r-main"><div class="r-title">${esc(w.word || '（无单词）')}</div><div class="r-sub">${esc([w.pos, w.meaning].filter(Boolean).join(' '))}${w.scene ? ' · ' + esc(w.scene) : ''}</div></div>${(w.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}<span class="chev">${ICONS.chev}</span></div>`).join('')}</div>`
      : `<div class="empty"><div class="e-ico">${ICONS.english}</div><p>词汇库还空着<br>点 + 录入第一个单词</p></div>`;
  } else if (ui.enTab === '学习计划') {
    body = `<div class="group"><div class="row"><div class="r-main"><div class="r-title" style="font-size:15px">今日任务</div><div class="r-sub">听力 Section 4 ×2 · 词汇 30 · 口语录音 1 段</div></div><span class="r-val">2/3</span></div>
    <div class="row"><div class="r-main"><div class="r-title" style="font-size:15px">12 月冲刺计划</div><div class="r-sub">第 3 周 · 共 6 周</div><div class="pbar"><i style="width:48%;background:#6FA8A0"></i></div></div></div></div>`;
  } else if (ui.enTab === '模考复盘') {
    body = `<div class="group"><div class="row"><div class="r-main"><div class="r-title" style="font-size:15px">11月2日 模考 · 总分 6.5</div><div class="r-sub">听 7.0 / 读 6.5 / 写 6.0 / 说 6.0 · 写作 Task 2 逻辑链待加强</div></div><span class="chev">${ICONS.chev}</span></div></div>`;
  } else {
    body = `<div class="empty"><div class="e-ico">${ICONS.english}</div><p>${ui.enTab}资料按分类收纳<br>（该区域将在后续版本开放录入）</p></div>`;
  }
  return `<div class="page">${head('英语', '/modules')}
  <div class="largetitle">英语 · 雅思</div>
  <div class="segwrap"><div class="seg">${tabs.map(t => `<div class="${t === ui.enTab ? 'on' : ''}" onclick="ui.enTab='${t}';render()">${t}</div>`).join('')}</div></div>
  ${body}
  ${ui.enTab === '词汇' ? `<button class="fab" onclick="go('/edit/english/new')">${ICONS.plus}</button>` : ''}</div>`;
}

/* =====================================================================
 * 找工作
 * ===================================================================== */
function pgJob() {
  const tabs = ['简历', '作品集', '面试', '人际关系'];
  const list = sortedItems('job').filter(v => (v.tab || '简历') === ui.jobTab);
  return `<div class="page">${head('找工作', '/modules', `<button class="iconbtn" onclick="go('/ocr/job')" title="截图导入 OCR">${ICONS.cam}</button>`)}
  <div class="largetitle">找工作</div>
  <div class="seg">${tabs.map(t => `<div class="${t === ui.jobTab ? 'on' : ''}" onclick="ui.jobTab='${t}';render()">${t}</div>`).join('')}</div>
  ${ui.jobTab === '人际关系' ? '<p class="notice" style="margin-bottom:12px">此模块可单独加锁（设置 → 敏感模块独立锁）。</p>' : ''}
  ${list.length ? `<div class="group">${list.map(v => `<div class="item" onclick="go('/edit/job/${v.id}')">
    <div class="i-main"><div class="i-t">${v.pin ? '<span class="pindot"></span>' : ''}${esc(titleOf('job', v))} ${v.fav ? '<span class="starx">★</span>' : ''}</div>
    <div class="i-m">${esc(metaOf('job', v))}${v.content ? '<br>' + esc(v.content) : ''}${v.link ? '<br>🔗 ' + esc(v.link) : ''}</div>
    ${(v.tags || []).length ? `<div class="i-tags">${v.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}</div>
    <span class="chev">${ICONS.chev}</span></div>`).join('')}</div>`
    : `<div class="empty"><div class="e-ico">${ICONS.job}</div><p>「${ui.jobTab}」下还没有内容</p></div>`}
  <div class="hcard" style="margin-top:12px" onclick="go('/ocr/job')"><div class="hthumb" style="background:#8FA3BF;width:46px;height:46px;border-radius:12px">${ICONS.cam}</div><div class="hc-main"><div class="hc-t">截图导入（本地 OCR）</div><div class="hc-s">识别 GitHub / 作品集 / 文档链接，确认后才保存</div></div></div>
  <button class="fab" onclick="go('/edit/job/new')">${ICONS.plus}</button></div>`;
}

/* =====================================================================
 * Prompt & Skills
 * ===================================================================== */
function pgPrompt() {
  const cats = ['全部', '写作', 'PPT', '设计', 'AI 工具', '视觉', '数据分析', '营销', '效率工具'];
  const q = ui.q || '';
  const list = sortedItems('prompt').filter(v =>
    (v.ptype || 'Prompt') === ui.pType &&
    (ui.pCat === '全部' || v.category === ui.pCat) &&
    (!q || JSON.stringify(v).includes(q)));
  return `<div class="page">${head('Prompt & Skills', '/modules', `<button class="iconbtn" onclick="go('/ocr/prompt')">${ICONS.cam}</button>`)}
  <div class="largetitle">Prompt & Skills</div>
  <div class="seg">${['Prompt', 'Skill'].map(t => `<div class="${t === ui.pType ? 'on' : ''}" onclick="ui.pType='${t}';render()">${t}</div>`).join('')}</div>
  <div class="chipline">${cats.map(c => `<div class="chip ${c === ui.pCat ? 'on' : ''}" onclick="ui.pCat='${c}';render()">${c}</div>`).join('')}</div>
  <div class="searchbar">${ICONS.search}<input placeholder="全文搜索内容、说明、来源…" value="${esc(q)}" oninput="ui.q=this.value;render()"></div>
  ${list.length ? `<div class="group">${list.map(v => `<div class="item" onclick="go('/edit/prompt/${v.id}')">
    <div class="i-main"><div class="i-t">${v.pin ? '<span class="pindot"></span>' : ''}${esc(titleOf('prompt', v))} ${v.fav ? '<span class="starx">★</span>' : ''}</div>
    <div class="i-m">${esc(metaOf('prompt', v))}${v.content ? '<br>' + esc(v.content) : ''}${v.github ? '<br>GitHub: ' + esc(v.github) : ''}</div>
    ${(v.tags || []).length ? `<div class="i-tags">${v.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}</div>
    <span class="chev">${ICONS.chev}</span></div>`).join('')}</div>`
    : `<div class="empty"><div class="e-ico">${ICONS.prompt}</div><p>该分类下暂无${ui.pType}</p></div>`}
  <button class="fab" onclick="go('/edit/prompt/new')">${ICONS.plus}</button></div>`;
}

/* =====================================================================
 * 随笔
 * ===================================================================== */
function pgNotes() {
  const list = sortedItems('notes');
  let body = '';
  if (ui.noteView === 'tl') {
    body = list.length
      ? list.map(n => `<div class="note-card" onclick="go('/edit/notes/${n.id}')"><div class="n-date">${new Date(n.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })} · ${esc(n.mood || '无心情标签')}</div><div class="n-txt">${esc(n.content)}</div></div>`).join('')
        + `<div style="text-align:center;margin:6px 0 4px"><span class="chip" onclick="randomNote()">随机回顾一篇</span></div>`
      : `<div class="empty"><div class="e-ico">${ICONS.notes}</div><p>写下第一篇随笔<br>草稿会自动保存</p></div>`;
  } else {
    const daysWith = new Set(list.map(n => new Date(n.createdAt).getDate()));
    let cells = ''; const first = new Date(); first.setDate(1);
    for (let i = 0; i < (first.getDay() + 6) % 7; i++) cells += '<span></span>';
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    for (let d2 = 1; d2 <= dim; d2++) cells += `<div class="cal-d ${d2 === new Date().getDate() ? 'today' : ''}" ${daysWith.has(d2) ? 'style="box-shadow:inset 0 -3px 0 0 #B0A090;font-weight:700"' : ''}>${d2}</div>`;
    body = `<div class="cal"><div class="cal-h"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="cal-g">${cells}</div>
    <p class="notice" style="margin-top:10px">下划线标记的日子写过随笔。草稿自动保存，支持全文搜索与随机回顾。</p></div>`;
  }
  return `<div class="page">${head('随笔', '/modules', `<button class="iconbtn" onclick="toast('全文搜索：演示')">${ICONS.search}</button>`)}
  <div class="largetitle">随笔</div>
  <div class="seg"><div class="${ui.noteView === 'tl' ? 'on' : ''}" onclick="ui.noteView='tl';render()">时间线</div><div class="${ui.noteView === 'cal' ? 'on' : ''}" onclick="ui.noteView='cal';render()">日历</div></div>
  ${body}
  <button class="fab" onclick="go('/edit/notes/new')">${ICONS.plus}</button></div>`;
}
function randomNote() {
  const list = S.list('notes');
  if (!list.length) return toast('还没有随笔可以回顾');
  const n = list[Math.floor(Math.random() * list.length)];
  confirmDanger('随机回顾 · ' + new Date(n.createdAt).toLocaleDateString('zh-CN'), esc((n.content || '').slice(0, 120)), '打开这篇', () => go('/edit/notes/' + n.id));
}

/* =====================================================================
 * 经期（数据驱动：平均周期与估算由记录计算）
 * ===================================================================== */
function periodEstimate() {
  const recs = S.list('period').filter(r => r.start).sort((a, b) => a.start < b.start ? -1 : 1);
  if (recs.length < 2) return null;
  const cycles = [];
  for (let i = 1; i < recs.length; i++) cycles.push((new Date(recs[i].start) - new Date(recs[i - 1].start)) / 86400000);
  const avg = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length);
  const last = new Date(recs[recs.length - 1].start);
  const next = new Date(last.getTime() + avg * 86400000);
  return { avg, next: (next.getMonth() + 1) + ' 月 ' + next.getDate() + ' 日', nextDate: next, lastStart: recs[recs.length - 1].start };
}
function pgPeriod() {
  const recs = S.list('period').sort((a, b) => b.start < a.start ? -1 : 1);
  const est = periodEstimate();
  const nowD = new Date(), y = nowD.getFullYear(), mo = nowD.getMonth();
  const first = new Date(y, mo, 1), dim = new Date(y, mo + 1, 0).getDate();
  let cells = ''; for (let i = 0; i < (first.getDay() + 6) % 7; i++) cells += '<span></span>';
  const inPeriod = d2 => recs.some(r => {
    if (!r.start) return false;
    const s = new Date(r.start), e = r.end ? new Date(r.end) : nowD;
    const t = new Date(y, mo, d2);
    return t >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) && t <= e;
  });
  const isEst = d2 => {
    if (!est) return false;
    const t = new Date(y, mo, d2);
    return t >= est.nextDate && t < est.nextDate.getTime() + 5 * 86400000;
  };
  for (let d2 = 1; d2 <= dim; d2++) cells += `<div class="cal-d ${inPeriod(d2) ? 'p' : ''} ${!inPeriod(d2) && isEst(d2) ? 'est' : ''} ${d2 === nowD.getDate() ? 'today' : ''}">${d2}</div>`;
  return `<div class="page">${head('经期', '/modules', `<span class="lockpill">${ICONS.lock} 已加锁</span>`)}
  <div class="largetitle">经期</div>
  <div class="cal"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b>${y} 年 ${mo + 1} 月</b></div>
  <div class="cal-h"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
  <div class="cal-g">${cells}</div></div>
  ${est ? `<div class="stat3"><div class="stat"><b>${est.avg} 天</b><span>平均周期</span></div><div class="stat"><b>5 天</b><span>平均经期</span></div><div class="stat"><b>${est.next.replace(' ', '')}</b><span>下次预计（估算）</span></div></div>`
    : `<p class="notice" style="margin-top:12px">至少记录两次经期后，才能计算平均周期与下次估算。</p>`}
  <div class="sec-h"><h3>历史记录</h3></div>
  ${recs.length ? `<div class="group">${recs.map(r => `<div class="row" onclick="go('/edit/period/${r.id}')"><div class="r-main"><div class="r-title" style="font-size:15px">${esc(r.start)} ${r.end ? '~ ' + esc(r.end) : '起 · 进行中'}</div><div class="r-sub">${r.note ? esc(r.note) : '无备注'} · ${timeAgo(r.updatedAt)}更新</div></div><span class="chev">${ICONS.chev}</span></div>`).join('')}</div>`
    : `<div class="empty"><div class="e-ico">${ICONS.period}</div><p>还没有经期记录</p></div>`}
  <p class="notice">图例：红色实心 = 经期记录，斜纹 = 预测（<b>估算</b>）。预测基于历史周期自动计算，仅供个人参考，不构成医学诊断或建议。</p>
  <button class="fab" onclick="go('/edit/period/new')">${ICONS.plus}</button></div>`;
}

/* =====================================================================
 * 旅行（去过 / 想去 数据驱动）
 * ===================================================================== */
function pgTravel() {
  const list = sortedItems('travel').filter(v => (v.ttype || 'gone') === ui.trTab);
  let body;
  if (ui.trTab === 'gone') {
    body = list.length ? `<div class="falls">${list.map(v => {
      const h = 130 + (String(v.id).charCodeAt(3) % 60);
      return `<div class="fall" style="height:${h}px;background:linear-gradient(135deg,#A8C8D8,#7C9EB0)" onclick="go('/album/${v.id}')">
        <div><div style="font-size:14px">${esc(v.destination || '（无目的地）')}</div><div style="font-weight:400;opacity:.85;margin-top:2px">${esc(v.date || '')} · 照片 ${(v.images || []).length} 张</div></div></div>`;
    }).join('')}</div>` : `<div class="empty"><div class="e-ico">${ICONS.travel}</div><p>记录去过的地方<br>照片不限数量，双列展示</p></div>`;
  } else {
    body = list.length ? `<div class="group">${list.map(v => {
      const cl = v.checklist || [], done = cl.filter(x => x.done).length;
      return `<div class="item" onclick="go('/edit/travel/${v.id}/want')">
      <div class="i-main"><div class="i-t">${esc(v.destination || '（无目的地）')}</div>
      <div class="i-m">${esc([v.planTime, v.budget].filter(Boolean).join(' · '))}${v.docs ? '<br>证件：' + esc(v.docs) : ''}${cl.length ? '<br>准备清单 ' + done + '/' + cl.length : ''}</div></div>
      <span class="chev">${ICONS.chev}</span></div>`;
    }).join('')}</div>` : `<div class="empty"><div class="e-ico">${ICONS.travel}</div><p>写下想去的地方<br>预算、证件、准备清单</p></div>`;
  }
  return `<div class="page">${head('旅行', '/modules')}
  <div class="largetitle">旅行</div>
  <div class="seg"><div class="${ui.trTab === 'gone' ? 'on' : ''}" onclick="ui.trTab='gone';render()">去过的地方</div><div class="${ui.trTab === 'want' ? 'on' : ''}" onclick="ui.trTab='want';render()">想去的地方</div></div>
  ${body}
  <button class="fab" onclick="go('/edit/travel/new/${ui.trTab}')">${ICONS.plus}</button></div>`;
}

/* =====================================================================
 * 旅行相册 v0.3 —— 「去过的地方」照片详情页
 * 流程：地点列表(/m/travel) → 相册页(/album/:id，双列瀑布流) → 全屏查看器
 * 数据：照片 Blob 存 IndexedDB（缩略图 360px + 原图 1280px 独立副本），
 *       记录里只存 photoId 数组，与地点 ID 一一关联，地点间天然隔离。
 * ===================================================================== */
let ALB = null;            // 当前相册会话 { id, edit, sel:Set, order:[] }
const fullURLCache = {};   // pid -> objectURL（查看器原图，独立于缩略图缓存）

function pgAlbum(id) {
  const rec = id ? S.get('travel', id) : null;
  if (!rec || (rec.ttype || 'gone') !== 'gone') {
    return `<div class="page">${head('相册', '/m/travel')}<div class="empty"><div class="e-ico">${ICONS.travel}</div><p>该地点不存在或已被删除</p></div></div>`;
  }
  if (!ALB || ALB.id !== id) ALB = { id, edit: false, sel: new Set(), order: [] };
  ALB.order = (rec.images || []).slice();
  const imgs = ALB.order, n = imgs.length;
  const name = rec.destination || '（无目的地）';
  const right = ALB.edit
    ? `<span class="q-btn" style="font-size:15px;font-weight:600" onclick="albumExitEdit()">完成</span>`
    : `<button class="iconbtn" onclick="albumEnterEdit()" title="管理照片">${ICONS.pencil}</button>`;
  const cells = imgs.map((pid, i) => `<div class="acell ${ALB.sel.has(pid) ? 'selon' : ''} loading" data-pid="${pid}" onclick="albumCellClick('${pid}',${i})">
    <img alt="照片 ${i + 1}" loading="lazy" draggable="false">
    <div class="asel ${ALB.sel.has(pid) ? 'on' : ''}">${ICONS.check}</div></div>`).join('');
  return `<div class="page ${ALB.edit ? 'album-edit' : ''}">
  ${head(esc(name), '/m/travel', right)}
  <div class="alb-sub">
    <span class="as-info">${esc(rec.date || '')}${n ? ' · ' + n + ' 张照片' : ' · 暂无照片'}</span>
    <span class="as-edit" onclick="go('/edit/travel/${id}/gone')">编辑资料</span>
  </div>
  ${n ? `<div class="acols">${cells}</div>`
    : `<div class="empty"><div class="e-ico">${ICONS.cam}</div><p>还没有这个地点的照片<br>从相册导入，双列瀑布流展示</p>
    <span class="chip" style="margin-top:16px;display:inline-block" onclick="document.getElementById('albfile').click()">添加照片</span></div>`}
  <input type="file" id="albfile" accept="image/*" multiple style="display:none" onchange="albumAddPhotos(this)">
  ${ALB.edit ? albumBarHtml(n) : ''}
  </div>`;
}

/* 编辑模式底部操作栏（渲染后挂到 .phone 下，避免随页面滚动） */
function albumBarHtml(n) {
  const sel = ALB.sel.size, all = n > 0 && sel === n;
  return `<div class="abar" id="abar">
    <span class="ab-count" id="abcount">已选 ${sel} 张</span>
    <button class="ab-btn" onclick="albumToggleAll()">${all ? '全不选' : '全选'}</button>
    <button class="ab-btn primary" onclick="document.getElementById('albfile').click()">添加照片</button>
    <button class="ab-btn danger" id="abdel" onclick="albumDeleteSel()"${sel ? '' : ' disabled'}>${sel ? '删除 ' + sel + ' 张' : '删除'}</button>
  </div>`;
}

/* ---------- 相册交互（选择切换只改 DOM，不整页重渲，保住滚动位置） ---------- */
function albumEnterEdit() { ALB.edit = true; render(); }
function albumExitEdit() { ALB.edit = false; ALB.sel.clear(); render(); }
function albumCellClick(pid, i) { if (ALB.edit) albumToggleSel(pid); else openViewer(i); }
function albumToggleSel(pid) {
  if (ALB.sel.has(pid)) ALB.sel.delete(pid); else ALB.sel.add(pid);
  const cell = document.querySelector('.acell[data-pid="' + pid + '"]');
  if (cell) {
    cell.classList.toggle('selon', ALB.sel.has(pid));
    const c = cell.querySelector('.asel');
    if (c) c.classList.toggle('on', ALB.sel.has(pid));
  }
  const el = document.getElementById('abcount');
  if (el) el.textContent = '已选 ' + ALB.sel.size + ' 张';
  const del = document.getElementById('abdel');
  if (del) { del.disabled = !ALB.sel.size; del.textContent = ALB.sel.size ? '删除 ' + ALB.sel.size + ' 张' : '删除'; }
}
function albumToggleAll() {
  const rec = S.get('travel', ALB.id);
  const imgs = (rec && rec.images) || [];
  if (imgs.length && ALB.sel.size === imgs.length) ALB.sel.clear();
  else { ALB.sel.clear(); imgs.forEach(pid => ALB.sel.add(pid)); }
  render();
}

/* 批量删除：二次确认 → 只动当前地点的 images 数组 → 保存 → 清 Blob → 刷新并退出编辑模式 */
function albumDeleteSel() {
  if (!ALB || !ALB.sel.size) return;
  const rec0 = S.get('travel', ALB.id);
  if (!rec0) return;
  const n = ALB.sel.size;
  confirmDanger('删除所选照片？', '将从「' + (rec0.destination || '该地点') + '」删除 ' + n + ' 张照片，其他地点不受影响。此操作不可恢复。', '删除 ' + n + ' 张', () => {
    const rec = S.get('travel', ALB.id);
    if (!rec) return;
    const del = Array.from(ALB.sel);
    rec.images = (rec.images || []).filter(pid => !ALB.sel.has(pid));
    persistTravelAlbum(rec);
    if (S.photos.available()) del.forEach(pid => {
      S.photos.remove(pid).catch(() => {});
      [photoURLCache, fullURLCache].forEach(cache => {
        if (cache[pid]) { try { URL.revokeObjectURL(cache[pid]); } catch (e) {} delete cache[pid]; }
      });
    });
    ALB.sel.clear(); ALB.edit = false;
    render();
    toast('已删除 ' + del.length + ' 张照片');
  });
}

/* 批量导入：不限张数，逐张压缩入库（ownerKey 与地点 ID 关联） */
async function albumAddPhotos(input) {
  const files = Array.from(input.files || []);
  input.value = '';
  if (!ALB || !files.length) return;
  if (!S.photos.available()) { toast('当前环境不支持图片存储'); return; }
  const rec = S.get('travel', ALB.id);
  if (!rec) return;
  let added = 0, skipped = 0;
  for (const f of files) {
    if (!/^image\//.test(f.type) || f.size > 30 * 1024 * 1024) { skipped++; continue; }
    try {
      const pid = await S.photos.add('travel_' + ALB.id, f);
      (rec.images = rec.images || []).push(pid);
      added++;
    } catch (e) { skipped++; }
  }
  persistTravelAlbum(rec);
  render();      // ALB.id 不变 → 编辑模式与已选状态保留
  toast('已添加 ' + added + ' 张照片' + (skipped ? '，' + skipped + ' 个文件跳过' : ''));
}

/* 保存相册改动；仅照片的地点删光照片时走 putRaw 保住记录本身 */
function persistTravelAlbum(rec) {
  const r = S.save('travel', Object.assign({}, rec), 'travel_gone');
  if (r.ok) return r.item;
  return S.putRaw('travel', rec);
}

/* ---------- 缩略图懒加载（IntersectionObserver + 渐进加载） ---------- */
function afterAlbumRender() {
  const bar = document.getElementById('abar');
  if (bar) document.getElementById('phone').appendChild(bar);   // 挂到手机壳，不随滚动（0 张照片的编辑模式同样生效）
  if (!ALB || !ALB.order.length || !S.photos.available()) return;
  const cells = Array.from(document.querySelectorAll('.acell'));
  if (!('IntersectionObserver' in window)) { cells.forEach(albumLoadThumb); return; }
  const io = new IntersectionObserver(ents => {
    ents.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); albumLoadThumb(en.target); } });
  }, { root: view, rootMargin: '400px 0px' });
  cells.forEach(c => io.observe(c));
}
function albumLoadThumb(cell) {
  const pid = cell.dataset.pid, img = cell.querySelector('img');
  if (!pid || !img) return;
  const fallback = () => { cell.classList.remove('loading'); cell.style.minHeight = '64px'; };
  const apply = url => {
    img.onload = () => {
      cell.style.minHeight = '0';
      if (img.naturalWidth && img.naturalHeight) cell.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
      cell.classList.remove('loading');
    };
    img.onerror = fallback;
    img.src = url;
  };
  if (photoURLCache[pid]) { apply(photoURLCache[pid]); return; }
  S.photos.get(pid).then(rec => {
    if (!rec || !rec.thumb) { fallback(); return; }
    photoURLCache[pid] = URL.createObjectURL(rec.thumb);
    apply(photoURLCache[pid]);
  }).catch(fallback);
}

/* =====================================================================
 * 全屏查看器：左右滑动切换 · 双指缩放 · 双击放大 · 点空白返回相册
 * Pointer Events 统一处理鼠标与触摸；strip 横向平移翻页，img 变换缩放平移
 * ===================================================================== */
const VIEWER = { open: false, idx: 0, list: [], scale: 1, tx: 0, ty: 0 };
let VG = null;   // 当前手势 { t:'drag'|'pinch', ... }

function openViewer(idx) {
  if (!ALB || !ALB.order.length) return;
  closeViewer();
  VIEWER.open = true;
  VIEWER.list = ALB.order.slice();
  VIEWER.idx = Math.max(0, Math.min(idx, VIEWER.list.length - 1));
  VIEWER.scale = 1; VIEWER.tx = 0; VIEWER.ty = 0;
  const el = document.createElement('div');
  el.id = 'viewer'; el.className = 'viewer';
  el.innerHTML = `
    <div class="v-top">
      <button class="v-btn" id="vclose" title="返回相册">${ICONS.close}</button>
      <span class="v-count" id="vcount"></span>
      <span style="width:36px"></span>
    </div>
    <div class="v-strip" id="vstrip">${VIEWER.list.map((pid, i) => `<div class="v-page"><img data-pid="${pid}" alt="照片 ${i + 1}" draggable="false"></div>`).join('')}</div>
    <button class="v-nav v-prev" id="vprev" title="上一张">${ICONS.chev}</button>
    <button class="v-nav v-next" id="vnext" title="下一张">${ICONS.chev}</button>
    <div class="v-hint">左右滑动切换 · 双指缩放 · 双击放大</div>`;
  document.getElementById('phone').appendChild(el);
  document.getElementById('vclose').onclick = closeViewer;
  document.getElementById('vprev').onclick = () => viewerStep(-1);
  document.getElementById('vnext').onclick = () => viewerStep(1);
  bindViewerGestures();
  viewerApply(true);
}
function closeViewer() {
  const el = document.getElementById('viewer');
  if (el) el.remove();
  if (VIEWER.open) { VIEWER.open = false; VIEWER.list = []; VG = null; }
  window.removeEventListener('keydown', viewerKeys);
}
function viewerStep(dir) {
  const n = VIEWER.idx + dir;
  if (!VIEWER.open || n < 0 || n >= VIEWER.list.length) return;
  VIEWER.idx = n; VIEWER.scale = 1; VIEWER.tx = 0; VIEWER.ty = 0;
  viewerApply();
}
function viewerApply(instant) {
  const strip = document.getElementById('vstrip');
  if (!strip) return;
  strip.classList.toggle('anim', !instant);
  strip.style.transform = 'translateX(' + (-VIEWER.idx * 100) + '%)';
  const imgs = strip.querySelectorAll('img');
  const cur = imgs[VIEWER.idx];
  if (cur) {
    cur.classList.toggle('zoomable', !instant);   // 手势进行中禁用过渡，松手后平滑归位
    cur.style.transform = 'translate(' + VIEWER.tx + 'px,' + VIEWER.ty + 'px) scale(' + VIEWER.scale + ')';
    [VIEWER.idx - 1, VIEWER.idx + 1].forEach(i => { if (imgs[i]) { imgs[i].classList.remove('zoomable'); imgs[i].style.transform = ''; } });
    viewerLoadImg(cur);
    if (imgs[VIEWER.idx + 1]) viewerLoadImg(imgs[VIEWER.idx + 1]);   // 预加载相邻页
    if (imgs[VIEWER.idx - 1]) viewerLoadImg(imgs[VIEWER.idx - 1]);
  }
  const c = document.getElementById('vcount');
  if (c) c.textContent = (VIEWER.idx + 1) + ' / ' + VIEWER.list.length;
}
function viewerLoadImg(img) {
  const pid = img && img.dataset.pid;
  if (!pid || img.src) return;
  if (fullURLCache[pid]) { img.src = fullURLCache[pid]; return; }
  if (!S.photos.available()) return;
  S.photos.get(pid).then(rec => {
    if (!rec || !rec.blob) return;
    const url = URL.createObjectURL(rec.blob);
    fullURLCache[pid] = url;
    if (!img.src) img.src = url;   // 可能已翻页，仅填充仍空白的 img
  }).catch(() => {});
}

/* 手势绑定 */
function bindViewerGestures() {
  const strip = document.getElementById('vstrip');
  const ptrs = new Map();
  let lastTap = 0, lastTapX = 0, lastTapY = 0;
  strip.addEventListener('pointerdown', e => {
    try { strip.setPointerCapture(e.pointerId); } catch (err) {}
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      VG = { t: 'pinch', s0: VIEWER.scale, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
             m0: viewerMid(a, b, strip), tx0: VIEWER.tx, ty0: VIEWER.ty };
    } else if (ptrs.size === 1) {
      VG = { t: 'drag', x0: e.clientX, y0: e.clientY, tx0: VIEWER.tx, ty0: VIEWER.ty, moved: false, t0: Date.now() };
    }
  });
  strip.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!VG) return;
    if (VG.t === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const m1 = viewerMid(a, b, strip);
      const s = Math.min(5, Math.max(1, VG.s0 * d / VG.d0));
      VIEWER.scale = s;
      VIEWER.tx = VG.tx0 + (m1.x - VG.m0.x) - (s / VG.s0 - 1) * (VG.m0.x - VG.tx0);
      VIEWER.ty = VG.ty0 + (m1.y - VG.m0.y) - (s / VG.s0 - 1) * (VG.m0.y - VG.ty0);
      viewerClampPan();
      viewerApply(true);
    } else if (VG.t === 'drag') {
      const dx = e.clientX - VG.x0, dy = e.clientY - VG.y0;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) VG.moved = true;
      if (VIEWER.scale > 1) {
        VIEWER.tx = VG.tx0 + dx; VIEWER.ty = VG.ty0 + dy;
        viewerClampPan();
        viewerApply(true);
      } else {
        strip.classList.remove('anim');
        strip.style.transform = 'translateX(' + (-VIEWER.idx * 100) + '%) translateX(' + dx + 'px)';
      }
    }
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size > 0) {   // 双指变单指：以剩余手指重置拖拽基准
      const rest = [...ptrs.values()][0];
      VG = { t: 'drag', x0: rest.x, y0: rest.y, tx0: VIEWER.tx, ty0: VIEWER.ty, moved: true, t0: Date.now() };
      return;
    }
    const g = VG; VG = null;
    if (!g) { viewerApply(); return; }
    if (g.t === 'pinch') {
      if (VIEWER.scale < 1.02) { VIEWER.scale = 1; VIEWER.tx = 0; VIEWER.ty = 0; }
      viewerApply(); return;
    }
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0, dt = Date.now() - g.t0;
    if (VIEWER.scale > 1) { viewerApply(true); return; }
    if (!g.moved && dt < 300) {
      const hit = document.elementFromPoint(e.clientX, e.clientY);   // 指针捕获会改写 target，用命中测试还原
      if (hit && hit.tagName === 'IMG') {
        const now = Date.now();
        if (now - lastTap < 320 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 32) {
          lastTap = 0;
          viewerZoomTo(e.clientX, e.clientY);
          return;
        }
        lastTap = now; lastTapX = e.clientX; lastTapY = e.clientY;
        viewerApply();
        return;
      }
      closeViewer();   // 点在图片外的黑色区域 → 返回相册
      return;
    }
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) viewerStep(dx < 0 ? 1 : -1);
    else viewerApply();
  };
  strip.addEventListener('pointerup', up);
  strip.addEventListener('pointercancel', e => {
    if (ptrs.has(e.pointerId)) ptrs.delete(e.pointerId);
    if (!ptrs.size) { VG = null; viewerApply(); }
  });
  window.addEventListener('keydown', viewerKeys);
}
function viewerMid(a, b, strip) {
  const r = strip.getBoundingClientRect();
  return { x: (a.x + b.x) / 2 - r.left - r.width / 2, y: (a.y + b.y) / 2 - r.top - r.height / 2 };
}
function viewerKeys(e) {
  if (!VIEWER.open) return;
  if (e.key === 'ArrowLeft') viewerStep(-1);
  else if (e.key === 'ArrowRight') viewerStep(1);
  else if (e.key === 'Escape') closeViewer();
}
function viewerZoomTo(cx, cy) {
  const strip = document.getElementById('vstrip');
  if (!strip) return;
  const r = strip.getBoundingClientRect();
  const mx = cx - r.left - r.width / 2, my = cy - r.top - r.height / 2;
  if (VIEWER.scale > 1) { VIEWER.scale = 1; VIEWER.tx = 0; VIEWER.ty = 0; }
  else {
    const s = 2.5;
    VIEWER.scale = s;
    VIEWER.tx = mx * (1 - s); VIEWER.ty = my * (1 - s);   // 保持点击点不动
  }
  viewerApply();
}
function viewerClampPan() {
  if (VIEWER.scale <= 1) { VIEWER.tx = 0; VIEWER.ty = 0; return; }
  const strip = document.getElementById('vstrip');
  if (!strip) return;
  const img = strip.querySelectorAll('img')[VIEWER.idx];
  if (!img || !img.naturalWidth) return;
  const r = strip.getBoundingClientRect();
  const fit = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
  const limX = Math.max(0, (img.naturalWidth * fit * VIEWER.scale - r.width) / 2);
  const limY = Math.max(0, (img.naturalHeight * fit * VIEWER.scale - r.height) / 2);
  VIEWER.tx = Math.max(-limX, Math.min(limX, VIEWER.tx));
  VIEWER.ty = Math.max(-limY, Math.min(limY, VIEWER.ty));
}

/* =====================================================================
 * 编辑器 —— 核心修复：严格按模块 FORMS 配置渲染
 * ===================================================================== */
let ED = null;             // 当前编辑会话
let saveTimer = null;
const photoURLCache = {};  // photoId -> objectURL（缩略图）
function clearPhotoCaches() {
  [photoURLCache, fullURLCache].forEach(cache => Object.keys(cache).forEach(k => {
    try { URL.revokeObjectURL(cache[k]); } catch (e) {}
    delete cache[k];
  }));
}

function formFor(module, record, subtype) {
  if (module === 'travel') {
    const st = record ? (record.ttype || 'gone') : (subtype || 'gone');
    return { key: st === 'want' ? 'travel_want' : 'travel_gone', form: S.FORMS[st === 'want' ? 'travel_want' : 'travel_gone'] };
  }
  return { key: module, form: S.FORMS[module] };
}

function pgEdit(module, id, subtype) {
  const record = id && id !== 'new' ? S.get(module, id) : null;
  const { key: formKey, form } = formFor(module, record, subtype);
  if (!form) return `<div class="page">${head('错误', '/modules')}<div class="empty"><p>未找到模块「${esc(module)}」的表单配置</p></div></div>`;
  const draftKey = (id && id !== 'new' ? id : 'new_' + (form.subtype || ''));
  const draft = S.getDraft(module, draftKey);
  let values = record ? Object.assign({}, record) : {};
  let draftNote = '';
  if (draft && draft.values && (!record || draft.ts > (record.updatedAt || 0))) {
    values = Object.assign(values, draft.values);
    draftNote = '已恢复未保存的草稿 · ' + timeAgo(draft.ts);
  }
  ED = { module, id: record ? record.id : null, formKey, form, values, draftKey };
  const isNew = !record;
  return `<div class="page">
  ${head((isNew ? '新建 · ' : '编辑 · ') + form.name, module === 'travel' ? '/m/travel' : '/m/' + module,
    `<span class="savestate" id="savestate">${draftNote || (isNew ? '草稿自动保存' : '已加载')}</span>`)}
  <p class="notice" style="margin-bottom:14px">所有字段均为选填，填写任意一项有效内容即可保存；完全空白不会创建记录。</p>
  ${form.fields.map(f => renderField(f, values[f.k])).join('')}
  <div style="display:flex;gap:10px;margin-top:6px">
    <button class="dangerbtn" style="margin:0;background:var(--txt);color:#fff" onclick="edSave()">保存</button>
  </div>
  ${isNew ? '' : `<button class="dangerbtn" onclick="edDelete()">删除</button>`}
  ${record ? `<p class="notice" style="margin-top:12px">创建于 ${new Date(record.createdAt).toLocaleString('zh-CN')} · 修改于 ${new Date(record.updatedAt).toLocaleString('zh-CN')}<br>数据归属：模块「${M(module).name}」 · 独立命名空间 pw_records_${module}</p>` : ''}
  </div>`;
}

/* ---------- 字段渲染（共享底层组件，不共享业务配置） ---------- */
function renderField(f, v) {
  const L = `<label>${esc(f.label)}</label>`;
  switch (f.type) {
    case 'text':
      return `<div class="field">${L}<input type="text" data-k="${f.k}" value="${esc(v || '')}" placeholder="选填" oninput="edSet('${f.k}',this.value)"></div>`;
    case 'link':
      return `<div class="field">${L}<input type="text" data-k="${f.k}" value="${esc(v || '')}" placeholder="https:// …（选填）" inputmode="url" oninput="edSet('${f.k}',this.value)"></div>`;
    case 'textarea':
      return `<div class="field">${L}<textarea data-k="${f.k}" placeholder="选填" oninput="edSet('${f.k}',this.value)">${esc(v || '')}</textarea></div>`;
    case 'date':
      return `<div class="field">${L}<input type="date" data-k="${f.k}" value="${esc(v || '')}" oninput="edSet('${f.k}',this.value)"></div>`;
    case 'select': {
      const opts = f.options || [];
      const isCustom = v && !opts.includes(v);
      return `<div class="field">${L}<input type="text" list="dl_${f.k}" data-k="${f.k}" value="${esc(v || '')}" placeholder="选择或输入自定义（选填）" oninput="edSet('${f.k}',this.value)">
      <datalist id="dl_${f.k}">${opts.concat(isCustom ? [v] : []).map(o => `<option value="${esc(o)}">`).join('')}</datalist></div>`;
    }
    case 'seg':
      return `<div class="field">${L}<div class="seg" style="margin:0">${f.options.map(o =>
        `<div class="${v === o ? 'on' : ''}" data-seg="${f.k}" data-v="${esc(o)}" onclick="edSeg('${f.k}','${esc(o)}',this)">${esc(o)}</div>`).join('')}</div></div>`;
    case 'chips':
      return `<div class="field">${L}<div class="moodrow">${f.options.map(o =>
        `<span class="mood ${v === o ? 'on' : ''}" onclick="edChip('${f.k}','${esc(o)}',this)">${esc(o)}</span>`).join('')}</div></div>`;
    case 'switch':
      return `<div class="field" style="display:flex;align-items:center;justify-content:space-between;background:var(--card);border-radius:var(--r-md);padding:6px 14px;box-shadow:var(--shadow)">${L.replace('style="', 'x="').replace('<label>', '<label style="margin:0">')}<div class="sw ${v ? 'on' : ''}" onclick="edSwitch('${f.k}',this)"></div></div>`;
    case 'rating': {
      const n = Number(v) || 0;
      return `<div class="field">${L}<div class="stars">${[1, 2, 3, 4, 5].map(i =>
        `<span class="star ${i <= n ? 'on' : ''}" onclick="edRate('${f.k}',${i})">★</span>`).join('')}<span class="sub" style="font-size:12px;margin-left:8px">${n ? n + ' 星（再点一次清零）' : '选填'}</span></div></div>`;
    }
    case 'tags': {
      const arr = Array.isArray(v) ? v : [];
      return `<div class="field">${L}<div class="i-tags" style="margin:0 0 8px" id="tags_${f.k}">${arr.map((t, i) =>
        `<span class="tag" style="cursor:pointer" onclick="edTagDel('${f.k}',${i})">${esc(t)} ✕</span>`).join('')}</div>
        <input type="text" placeholder="输入标签后回车添加（选填）" onkeydown="if(event.key==='Enter'){edTagAdd('${f.k}',this)}"></div>`;
    }
    case 'custom': {
      const arr = Array.isArray(v) ? v : [];
      return `<div class="field">${L}<div id="custom_${f.k}">${arr.map((row, i) => `
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input type="text" style="flex:2" placeholder="字段名" value="${esc(row.key || '')}" oninput="edCustomSet('${f.k}',${i},'key',this.value)">
          <input type="text" style="flex:3" placeholder="内容" value="${esc(row.value || '')}" oninput="edCustomSet('${f.k}',${i},'value',this.value)">
          <button class="iconbtn" onclick="edCustomDel('${f.k}',${i})">${ICONS.close}</button>
        </div>`).join('')}</div>
        <button class="chip" onclick="edCustomAdd('${f.k}')">＋ 添加自定义字段</button></div>`;
    }
    case 'checklist': {
      const arr = Array.isArray(v) ? v : [];
      return `<div class="field">${L}<div class="group" id="cl_${f.k}">${arr.map((c, i) => `
        <div class="row" style="min-height:44px">
          <div class="ocr-cb ${c.done ? 'on' : ''}" onclick="edClToggle('${f.k}',${i})">${c.done ? ICONS.check : ''}</div>
          <div class="r-main" style="${c.done ? 'text-decoration:line-through;color:var(--txt3)' : ''}">${esc(c.text)}</div>
          <span class="q-btn" style="color:var(--red);cursor:pointer" onclick="edClDel('${f.k}',${i})">删除</span>
        </div>`).join('')}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input type="text" style="flex:1" id="clin_${f.k}" placeholder="添加准备事项，回车确认" onkeydown="if(event.key==='Enter')edClAdd('${f.k}')">
          <button class="chip" onclick="edClAdd('${f.k}')">添加</button>
        </div></div>`;
    }
    case 'images': {
      const arr = Array.isArray(v) ? v : [];
      return `<div class="field">${L}<div class="imgrow" id="imgs_${f.k}">
        ${arr.map((pid, i) => `<div class="ph" data-pid="${pid}">
          <img alt="图片 ${i + 1}" loading="lazy">
          <div class="ph-ops"><span onclick="edImgMove('${f.k}',${i},-1)">‹</span><span onclick="edImgMove('${f.k}',${i},1)">›</span><span onclick="edImgDel('${f.k}',${i})">✕</span></div>
        </div>`).join('')}
        <div class="imgadd" onclick="document.getElementById('file_${f.k}').click()">${ICONS.cam}<span>添加图片</span></div>
      </div>
      <input type="file" id="file_${f.k}" accept="image/*" multiple style="display:none" onchange="edImgAdd('${f.k}',this)">
      <p class="sub" style="font-size:12px;margin-top:6px">支持一次选择多张；‹ › 调整顺序，✕ 删除。自动生成缩略图，独立副本保存。</p></div>`;
    }
    default:
      return '';
  }
}

/* ---------- 编辑会话操作 ---------- */
function edSet(k, v) { ED.values[k] = v; markDirty(); }
function edSeg(k, v, el) { ED.values[k] = v; el.parentElement.querySelectorAll('div').forEach(d => d.classList.toggle('on', d === el)); markDirty(); }
function edChip(k, v, el) { ED.values[k] = ED.values[k] === v ? '' : v; el.parentElement.querySelectorAll('.mood').forEach(d => d.classList.toggle('on', d === el && ED.values[k] === v)); markDirty(); }
function edSwitch(k, el) { ED.values[k] = !ED.values[k]; el.classList.toggle('on', !!ED.values[k]); markDirty(); }
function edRate(k, i) { ED.values[k] = (Number(ED.values[k]) || 0) === i ? 0 : i; rerenderEditor(); markDirty(); }
function edTagAdd(k, input) {
  const t = input.value.trim(); if (!t) return;
  ED.values[k] = (Array.isArray(ED.values[k]) ? ED.values[k] : []).concat(t);
  rerenderEditor(); markDirty();
}
function edTagDel(k, i) { ED.values[k] = (ED.values[k] || []).filter((_, x) => x !== i); rerenderEditor(); markDirty(); }
function edCustomAdd(k) { ED.values[k] = (Array.isArray(ED.values[k]) ? ED.values[k] : []).concat({ key: '', value: '' }); rerenderEditor(); markDirty(); }
function edCustomDel(k, i) { ED.values[k] = (ED.values[k] || []).filter((_, x) => x !== i); rerenderEditor(); markDirty(); }
function edCustomSet(k, i, prop, v) { if (ED.values[k] && ED.values[k][i]) ED.values[k][i][prop] = v; markDirty(); }
function edClAdd(k) {
  const input = document.getElementById('clin_' + k);
  const t = (input.value || '').trim(); if (!t) return;
  ED.values[k] = (Array.isArray(ED.values[k]) ? ED.values[k] : []).concat({ text: t, done: false });
  rerenderEditor(); markDirty();
}
function edClToggle(k, i) { if (ED.values[k] && ED.values[k][i]) { ED.values[k][i].done = !ED.values[k][i].done; rerenderEditor(); markDirty(); } }
function edClDel(k, i) { ED.values[k] = (ED.values[k] || []).filter((_, x) => x !== i); rerenderEditor(); markDirty(); }

/* 图片：多选上传 / 排序 / 删除 */
async function edImgAdd(k, input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  if (!S.photos.available()) { toast('当前环境不支持图片存储'); return; }
  const sv = document.getElementById('savestate');
  if (sv) { sv.textContent = '正在处理图片…'; sv.classList.add('saving'); }
  for (const f of files) {
    if (!/^image\//.test(f.type)) { toast('已跳过非图片文件：' + f.name); continue; }
    if (f.size > 30 * 1024 * 1024) { toast('已跳过超大图片（>30MB）：' + f.name); continue; }
    try {
      const pid = await S.photos.add(ED.module + '_' + ED.draftKey, f);
      ED.values[k] = (Array.isArray(ED.values[k]) ? ED.values[k] : []).concat(pid);
    } catch (e) { toast('图片导入失败：' + f.name); }
  }
  input.value = '';
  rerenderEditor(); markDirty();
}
function edImgMove(k, i, dir) {
  const arr = ED.values[k] || [];
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  rerenderEditor(); markDirty();
}
function edImgDel(k, i) {
  const arr = ED.values[k] || [];
  const [pid] = arr.splice(i, 1);
  if (S.photos.available()) S.photos.remove(pid).catch(() => {});
  delete photoURLCache[pid];
  rerenderEditor(); markDirty();
}
function rerenderEditor() {
  const keep = view.scrollTop;
  view.innerHTML = pgEditCurrent();
  afterEditRender();
  view.scrollTop = keep;
}
function pgEditCurrent() {
  // 基于现有 ED 会话重渲染（不重读草稿，避免覆盖正在编辑的内容）
  const form = ED.form, values = ED.values;
  const isNew = !ED.id;
  return `<div class="page">
  ${head((isNew ? '新建 · ' : '编辑 · ') + form.name, ED.module === 'travel' ? '/m/travel' : '/m/' + ED.module,
    `<span class="savestate" id="savestate">已加载</span>`)}
  <p class="notice" style="margin-bottom:14px">所有字段均为选填，填写任意一项有效内容即可保存；完全空白不会创建记录。</p>
  ${form.fields.map(f => renderField(f, values[f.k])).join('')}
  <div style="display:flex;gap:10px;margin-top:6px">
    <button class="dangerbtn" style="margin:0;background:var(--txt);color:#fff" onclick="edSave()">保存</button>
  </div>
  ${isNew ? '' : `<button class="dangerbtn" onclick="edDelete()">删除</button>`}
  </div>`;
}

/* 草稿自动保存（防抖 600ms） */
function markDirty() {
  const sv = document.getElementById('savestate');
  if (sv) { sv.textContent = '正在保存…'; sv.classList.add('saving'); }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!ED) return;
    S.setDraft(ED.module, ED.draftKey, ED.values);
    if (sv) { sv.textContent = '草稿已自动保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); sv.classList.remove('saving'); }
  }, 600);
}

/* 保存：任意有效内容即可；空白不落库 */
function edSave() {
  if (!ED) return;
  const values = Object.assign({}, ED.values);
  if (ED.id) values.id = ED.id;
  values.__draftKey = ED.draftKey;
  const r = S.save(ED.module, values, ED.formKey);
  if (!r.ok) {
    if (r.reason === 'empty') toast('未填写任何有效内容，未创建记录');
    else toast('保存失败：' + r.reason);
    return;
  }
  S.clearDraft(ED.module, ED.draftKey);
  ED.id = r.item.id;
  toast('已保存到「' + M(ED.module).name + '」', '查看', () => go(ED.module === 'travel' ? '/m/travel' : '/m/' + ED.module));
  go(ED.module === 'travel' ? '/m/travel' : '/m/' + ED.module);
}

/* 删除：确认 + 可撤销；撤销窗口过后才清理图片文件 */
let pendingPhotoCleanup = null;
function edDelete() {
  if (!ED || !ED.id) return;
  const { module, id } = ED;
  confirmDanger('删除这条记录？', '删除后可立即撤销；图片附件会一并清理。', '删除', () => {
    const removed = S.remove(module, id);
    if (!removed) { toast('记录不存在'); return; }
    clearTimeout(pendingPhotoCleanup);
    const imgs = removed.images || [];
    pendingPhotoCleanup = setTimeout(() => { if (S.photos.available()) S.photos.removeMany(imgs); }, 6000);
    S.clearDraft(module, ED.draftKey);
    go(module === 'travel' ? '/m/travel' : '/m/' + module);
    setTimeout(() => toast('已删除', '撤销', () => {
      clearTimeout(pendingPhotoCleanup);
      S.restore(module, removed);
      toast('已恢复');
    }), 300);
  });
}

/* 编辑器渲染后：为图片占位填充缩略图 */
function afterEditRender() {
  if (!ED || !S.photos.available()) return;
  ED.form.fields.filter(f => f.type === 'images').forEach(f => {
    (ED.values[f.k] || []).forEach(pid => {
      const box = document.querySelector(`.ph[data-pid="${pid}"] img`);
      if (!box) return;
      if (photoURLCache[pid]) { box.src = photoURLCache[pid]; return; }
      S.photos.get(pid).then(rec => {
        if (rec && rec.thumb) {
          const url = URL.createObjectURL(rec.thumb);
          photoURLCache[pid] = url;
          box.src = url;
        }
      }).catch(() => {});
    });
  });
}

/* =====================================================================
 * OCR 确认流程（演示识别，确认后才保存 → 真实落库）
 * ===================================================================== */
let ocrItems = [];
function pgOCR(mod) {
  if (!ocrItems.length) {
    ocrItems = [
      { u: 'github.com/user/portfolio-2025', k: 'GitHub', sel: true },
      { u: 'dribbble.com/kexin', k: '作品集', sel: true },
      { u: 'docs.qq.com/doc/DZHR4…', k: '文档', sel: false },
      { u: 'mp.weixin.qq.com/s/x8f2…', k: '网页', sel: true }
    ];
  }
  const badge = { GitHub: ['#24292F', '#F0F0F2'], 作品集: ['#B0496B', '#FBE9F0'], 文档: ['#0A84FF', '#E8F1FE'], 网页: ['#6E6E73', '#F0F0F2'] };
  return `<div class="page">${head('截图识别结果', '/m/' + mod)}
  <div class="largetitle" style="font-size:26px">识别到 ${ocrItems.length} 个链接</div>
  <p class="notice" style="margin-bottom:14px">识别在设备端完成（原生版使用 iOS Vision），未经确认不会保存任何内容。</p>
  <div class="group">${ocrItems.map((o, i) => `<div class="ocr-row">
    <div class="ocr-cb ${o.sel ? 'on' : ''}" onclick="ocrItems[${i}].sel=!ocrItems[${i}].sel;render()">${o.sel ? ICONS.check : ''}</div>
    <div class="r-main"><div class="urltext">${esc(o.u)}</div><div style="margin-top:5px"><span class="ocr-badge" style="color:${badge[o.k][0]};background:${badge[o.k][1]}">${o.k}</span></div></div>
    <span class="q-btn" style="color:var(--red);font-size:13px;cursor:pointer" onclick="ocrItems.splice(${i},1);render()">删除</span>
  </div>`).join('')}</div>
  <div style="display:flex;gap:10px;margin-top:16px">
    <button class="dangerbtn" style="margin:0;color:var(--txt);font-weight:500" onclick="ocrItems=[];toast('可手动输入链接')">全部清除</button>
    <button class="dangerbtn" style="margin:0;background:var(--txt);color:#fff" onclick="ocrSave('${mod}')">保存所选（${ocrItems.filter(x => x.sel).length}）</button>
  </div></div>`;
}
function ocrSave(mod) {
  const sel = ocrItems.filter(x => x.sel);
  if (!sel.length) { toast('未勾选任何链接'); return; }
  let saved = 0;
  sel.forEach(o => {
    const r = S.save(mod, mod === 'job'
      ? { tab: '作品集', kind: '链接', title: o.u, link: o.u, content: '来自截图 OCR 导入（' + o.k + '）' }
      : { ptype: 'Prompt', title: o.u, link: o.u, content: '来自截图 OCR 导入（' + o.k + '）' });
    if (r.ok) saved++;
  });
  ocrItems = [];
  go('/m/' + mod);
  setTimeout(() => toast('已保存 ' + saved + ' 条链接（经你确认）'), 300);
}

/* =====================================================================
 * 设置（导出/导入为真实功能）
 * ===================================================================== */
const SW = { backup: true, applock: true, bio: true, hidepreview: true, periodlock: true, noteshome: true };
function pgSettings() {
  const s = (k, l, sub) => `<div class="row" onclick="SW.${k}=!SW.${k};render()"><div class="r-main"><div class="r-title" style="font-size:15.5px">${l}</div>${sub ? `<div class="r-sub">${sub}</div>` : ''}</div><div class="sw ${SW[k] ? 'on' : ''}"></div></div>`;
  const ln = (l, v, act) => `<div class="row" onclick="${act || ''}"><div class="r-main"><div class="r-title" style="font-size:15.5px">${l}</div></div><span class="r-val">${v || ''}</span><span class="chev">${ICONS.chev}</span></div>`;
  const total = S.moduleKeys().reduce((n, m) => n + S.list(m).length, 0);
  return `<div class="page">${head('设置')}
  <div class="largetitle">设置</div>
  <h5 class="gap">备份与迁移</h5><div class="group">
    ${ln('导出全部数据', 'JSON · ' + total + ' 条记录', 'doExport()')}
    ${ln('导入备份', '校验版本 · 失败不写入', "document.getElementById('impfile').click()")}
    ${s('backup', '自动备份', '仅保存到本机你授权的目录，不上传云端')}
    ${ln('数据规模', total + ' 条记录 · 10 个模块隔离存储')}
  </div>
  <input type="file" id="impfile" accept=".json" style="display:none" onchange="doImport(this)">
  <h5 class="gap">存储</h5><div class="group">
    ${ln('存储空间统计', '记录数据 + 图片（IndexedDB）', "toast('记录存 localStorage；图片存 IndexedDB（Blob，非 Base64）')")}
    ${ln('清理缓存', '缩略图与原图对象 URL 缓存', "clearPhotoCaches();toast('缓存已清理，数据未受影响')")}
  </div>
  <h5 class="gap">隐私与安全</h5><div class="group">
    ${s('applock', 'App 锁', '打开 App 时需要验证')}
    ${s('bio', '生物识别', 'Face ID / 指纹，失败时可用设备密码')}
    ${ln('自动锁定时间', '5 分钟')}
    ${s('hidepreview', '后台任务预览隐藏', '多任务界面模糊内容')}
    ${s('periodlock', '敏感模块独立锁', '随笔 · 经期 · 人际关系')}
    ${ln('隐私说明', '数据仅存本机', "toast('原型数据存于浏览器本地；原生版存 App 私有目录，OCR 全部在设备端')")}
  </div>
  <h5 class="gap">首页</h5><div class="group">
    ${s('noteshome', '首页显示经期预测', '可关闭；预测始终标注「估算」')}
    ${ln('模块管理', '排序 · 固定 · 隐藏', "go('/modules')")}
  </div>
  <h5 class="gap">通用</h5><div class="group">
    ${ln('恢复默认设置', '', "confirmDanger('恢复默认设置？','你的数据不会被删除。','恢复',()=>toast('已恢复默认设置'))")}
  </div>
  <button class="dangerbtn" onclick="confirmDanger('清空全部数据？','将删除全部模块记录（图片缓存随后清理）。建议先导出备份。','清空全部数据',wipeAll)">清空全部数据</button>
  <p class="notice">原型阶段：记录数据导出为 JSON；图片的原生完整备份（数据库+附件打包）将在 Flutter 版本中实现。卸载 App / 清除浏览器数据会删除未备份内容，请定期导出。</p>
  </div>`;
}
function doExport() {
  const json = S.exportAll();
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'private-workbench-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('已导出备份文件（' + Math.round(json.length / 1024) + ' KB）');
}
function doImport(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const r = S.importAll(String(reader.result));
      toast('恢复完成：' + r.records + ' 条记录 · ' + r.modules + ' 个模块');
      render();
    } catch (e) {
      toast('导入失败：' + e.message + '（原数据未受影响）');
    }
  };
  reader.readAsText(f);
  input.value = '';
}
function wipeAll() {
  S.moduleKeys().forEach(m => localStorage.removeItem('pw_records_' + m));
  toast('已清空全部记录');
  render();
}

/* ---------- 通用组件 ---------- */
function confirmDanger(title, sub, ok, cb) {
  const sm = document.getElementById('sheetmask'), sh = document.getElementById('sheet');
  sh.innerHTML = `<div class="s-group"><div class="s-title">${title}<br><span style="font-size:12px">${sub}</span></div><button class="s-btn danger" id="sok">${ok}</button></div><div class="s-group"><button class="s-btn s-cancel" onclick="closeSheet()">取消</button></div>`;
  sm.classList.add('show'); sh.classList.add('show');
  document.getElementById('sok').onclick = () => { closeSheet(); cb && cb(); };
}
function closeSheet() {
  const sm = document.getElementById('sheetmask'), sh = document.getElementById('sheet');
  if (sm) sm.classList.remove('show');
  if (sh) sh.classList.remove('show');
}
let toastTimer = null;
function toast(txt, act, cb) {
  const t = document.getElementById('toast');
  document.getElementById('toastTxt').textContent = txt;
  const a = document.getElementById('toastAct');
  a.textContent = act || '';
  a.onclick = () => { clearToast(); cb && cb(); };
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(clearToast, act ? 5000 : 2400);
}
function clearToast() { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }

/* ---------- 启动 ---------- */
S.seed();
render();
