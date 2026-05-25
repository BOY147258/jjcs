/**
 * 竞迹 — 成绩管理后台 (localStorage 版，无需后端)
 * 成绩由计时端保存在 localStorage['jjcs-history'] 中。
 * 兼容读取早期原型使用的 localStorage['jingjitimer-history']。
 */

const STORAGE_KEY = 'jjcs-history';
const LEGACY_STORAGE_KEY = 'jingjitimer-history';

// ── 工具函数 ─────────────────────────────────────────────
function msToDisplay(ms) {
  if (ms == null || ms < 0) return '—';
  const m  = Math.floor(ms / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return m > 0
    ? `${m}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`
    : `${s}.${String(cs).padStart(2,'0')}`;
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── localStorage 读写 ────────────────────────────────────
function loadHistory() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (current.length) return current;
    return JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]');
  }
  catch { return []; }
}
function saveHistory(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

async function fetchServerHistory() {
  try {
    const res = await fetch('/api/groups', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

async function getHistory() {
  const serverHistory = await fetchServerHistory();
  const localHistory = loadHistory();
  if (serverHistory && (serverHistory.length || !localHistory.length)) return serverHistory;
  return localHistory;
}

// ── Toast ────────────────────────────────────────────────
let _toastTimer;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

// ── 导航 ─────────────────────────────────────────────────
const pages = {};
document.querySelectorAll('.page').forEach(p => {
  pages[p.id.replace('page-','')] = p;
});
let currentPage = 'results';

document.querySelectorAll('.nav-link').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    showPage(a.dataset.page);
  });
});
function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');
  const link = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (link) link.classList.add('active');
  loaders[page]?.();
}

// ── 筛选状态 ─────────────────────────────────────────────
let filterRoom = '', filterDist = '', filterDate = '';

// ── 成绩页 ───────────────────────────────────────────────
async function loadResults() {
  const history = await getHistory();

  // 填充筛选下拉
  const rooms = [...new Set(history.map(g => g.roomCode).filter(Boolean))].sort();
  const dists = [...new Set(history.map(g => g.distance).filter(Boolean))].sort((a,b)=>a-b);
  const dates = [...new Set(history.map(g => (g.date||'').slice(0,10)).filter(Boolean))].sort().reverse();

  const selRoom = document.getElementById('filter-room');
  const selDist = document.getElementById('filter-dist');
  const selDate = document.getElementById('filter-date');

  const prev = { room: selRoom.value, dist: selDist.value, date: selDate.value };

  selRoom.innerHTML = '<option value="">— 全部房间 —</option>' +
    rooms.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  selDist.innerHTML = '<option value="">— 全部距离 —</option>' +
    dists.map(d => `<option value="${d}">${d} m</option>`).join('');
  selDate.innerHTML = '<option value="">— 全部日期 —</option>' +
    dates.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');

  selRoom.value = prev.room;
  selDist.value = prev.dist;
  selDate.value = prev.date;

  filterRoom = selRoom.value;
  filterDist = selDist.value;
  filterDate = selDate.value;

  renderResults(history);
}

function renderResults(history) {
  const tbody = document.querySelector('#results-table tbody');
  if (!tbody) return;

  // 应用筛选
  let groups = history.filter(g => {
    if (filterRoom && g.roomCode !== filterRoom) return false;
    if (filterDist && String(g.distance) !== String(filterDist)) return false;
    if (filterDate && !(g.date||'').startsWith(filterDate)) return false;
    return true;
  });

  if (!groups.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty">暂无成绩记录</td></tr>';
    document.getElementById('result-count').textContent = '0 条成绩';
    return;
  }

  // 按日期倒序、再按轮次/组别
  groups.sort((a,b) => (b.date||'') > (a.date||'') ? 1 : -1);

  const medals = ['🥇','🥈','🥉'];
  const rows = [];
  let totalCount = 0;

  groups.forEach(g => {
    const sorted = [...(g.results||[])].sort((a,b) => {
      if (a.isDNF && !b.isDNF) return 1;
      if (!a.isDNF && b.isDNF) return -1;
      return (a.raceTime||Infinity) - (b.raceTime||Infinity);
    });

    sorted.forEach((r, idx) => {
      totalCount++;
      const rank = r.isDNF ? 'DNF' : (medals[idx] || `${idx+1}`);
      rows.push(`<tr class="${idx===0?'row-gold':idx===1?'row-silver':idx===2?'row-bronze':''}">
        <td>${rank}</td>
        <td class="time-cell">${r.isDNF ? 'DNF' : msToDisplay(r.raceTime)}</td>
        <td>${esc(r.name||`${r.laneIdx!=null?r.laneIdx+1:'?'}道`)}</td>
        <td>${r.laneIdx!=null?r.laneIdx+1:'—'}道</td>
        <td>${esc(g.distance)}m${g.laps>1?` × ${g.laps}圈`:''}</td>
        <td>第${g.round||1}轮 第${g.group||1}组</td>
        <td>${esc(g.roomCode||'—')}</td>
        <td>${esc((g.date||'').slice(0,10))}</td>
        <td><button class="btn-danger btn-sm" onclick="deleteGroup('${g.id}')">删除</button></td>
      </tr>`);
    });

    // 组间隔行
    rows.push(`<tr class="group-sep"><td colspan="9">${esc(g.raceName||'比赛')} · 第${g.round||1}轮第${g.group||1}组 · ${esc(g.distance)}m · 房间 ${esc(g.roomCode||'—')} · ${esc((g.date||'').slice(0,10))}</td></tr>`);
  });

  tbody.innerHTML = rows.join('');
  document.getElementById('result-count').textContent = `${totalCount} 条成绩`;
}

// ── 删除一组 ─────────────────────────────────────────────
function deleteGroup(id) {
  if (!confirm('确认删除这组成绩？')) return;
  let history = loadHistory();
  history = history.filter(g => g.id !== id);
  saveHistory(history);
  loadResults();
  toast('已删除', 'warn');
}
async function deleteGroupServerFirst(id) {
  if (!confirm('确认删除这组成绩？')) return;
  try {
    const res = await fetch(`/api/groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      await loadResults();
      toast('已删除', 'warn');
      return;
    }
  } catch {}
  let history = loadHistory();
  history = history.filter(g => g.id !== id);
  saveHistory(history);
  await loadResults();
  toast('已删除', 'warn');
}
window.deleteGroup = deleteGroupServerFirst;

// ── 概览页 ───────────────────────────────────────────────
async function loadOverview() {
  const history = await getHistory();
  const totalGroups   = history.length;
  const totalResults  = history.reduce((s,g) => s + (g.results||[]).length, 0);
  const totalRooms    = new Set(history.map(g=>g.roomCode).filter(Boolean)).size;
  const totalDists    = new Set(history.map(g=>g.distance).filter(Boolean)).size;

  document.getElementById('st-groups').textContent   = totalGroups;
  document.getElementById('st-results').textContent  = totalResults;
  document.getElementById('st-rooms').textContent    = totalRooms;
  document.getElementById('st-dists').textContent    = totalDists;

  // 最近10组
  const tbody = document.querySelector('#recent-table tbody');
  if (!tbody) return;
  const recent = [...history].sort((a,b)=>(b.date||'')>(a.date||'')?1:-1).slice(0,10);
  tbody.innerHTML = recent.map(g => {
    const best = (g.results||[]).filter(r=>!r.isDNF).sort((a,b)=>a.raceTime-b.raceTime)[0];
    return `<tr>
      <td>${esc((g.date||'').slice(0,10))}</td>
      <td>${esc(g.raceName||'比赛')}</td>
      <td>${esc(g.distance)}m</td>
      <td>第${g.round||1}轮 第${g.group||1}组</td>
      <td class="time-cell">${best ? msToDisplay(best.raceTime) : '—'}</td>
      <td>${esc(best?.name||'—')}</td>
      <td>${esc(g.roomCode||'—')}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" class="empty">暂无数据</td></tr>';
}

// ── 导出页 ───────────────────────────────────────────────
async function loadExport() {
  const history = await getHistory();
  const rooms = [...new Set(history.map(g=>g.roomCode).filter(Boolean))].sort();
  const selExp = document.getElementById('exp-room');
  if (selExp) {
    selExp.innerHTML = '<option value="">— 全部 —</option>' +
      rooms.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
  }
}

function exportCSV(groups) {
  const headers = ['日期','房间','比赛名称','距离','轮次','组别','排名','姓名','道次','成绩(秒)','成绩','是否DNF'];
  const rows = [];
  groups.forEach(g => {
    const sorted = [...(g.results||[])].sort((a,b)=>(a.raceTime||Infinity)-(b.raceTime||Infinity));
    sorted.forEach((r,i) => {
      rows.push([
        (g.date||'').slice(0,10),
        g.roomCode||'',
        g.raceName||'比赛',
        g.distance,
        g.round||1,
        g.group||1,
        r.isDNF ? 'DNF' : i+1,
        r.name||`${r.laneIdx!=null?r.laneIdx+1:'?'}道`,
        r.laneIdx!=null?r.laneIdx+1:'',
        r.isDNF ? '' : ((r.raceTime||0)/1000).toFixed(2),
        r.isDNF ? 'DNF' : msToDisplay(r.raceTime),
        r.isDNF ? '是' : '否',
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    });
  });

  const csv = '﻿' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `竞迹成绩_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── 清除所有 ──────────────────────────────────────────────
document.getElementById('btn-clear-all')?.addEventListener('click', () => {
  if (!confirm('确认清除所有历史成绩？此操作不可撤销')) return;
  saveHistory([]);
  loadResults();
  toast('已清除所有成绩', 'warn');
});

// ── 筛选事件 ─────────────────────────────────────────────
document.getElementById('filter-room')?.addEventListener('change', async e => { filterRoom = e.target.value; renderResults(await getHistory()); });
document.getElementById('filter-dist')?.addEventListener('change', async e => { filterDist = e.target.value; renderResults(await getHistory()); });
document.getElementById('filter-date')?.addEventListener('change', async e => { filterDate = e.target.value; renderResults(await getHistory()); });
document.getElementById('btn-clear-filter')?.addEventListener('click', () => {
  filterRoom = filterDist = filterDate = '';
  loadResults();
});

// ── 导出按钮 ─────────────────────────────────────────────
document.getElementById('btn-exp-all')?.addEventListener('click', () => {
  getHistory().then(history => exportCSV(history));
  toast('已导出全部成绩');
});
document.getElementById('btn-exp-room')?.addEventListener('click', async () => {
  const room = document.getElementById('exp-room')?.value;
  const history = await getHistory();
  const data = room ? history.filter(g=>g.roomCode===room) : history;
  exportCSV(data);
  toast(`已导出${room?`房间 ${room} 的`:'全部'}成绩`);
});

// ── 刷新按钮 ─────────────────────────────────────────────
document.getElementById('btn-refresh')?.addEventListener('click', () => {
  loaders[currentPage]?.();
  toast('已刷新');
});

// ── page loaders map ─────────────────────────────────────
const loaders = {
  overview: loadOverview,
  results:  loadResults,
  export:   loadExport,
};

// ── 初始化 ───────────────────────────────────────────────
showPage('results');
