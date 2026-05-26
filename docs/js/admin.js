import { getAdminHeaders, getStoredAdminToken, setStoredAdminToken } from './admin-auth.js';

const STORAGE_KEY = 'jjcs-history';
const LEGACY_STORAGE_KEY = 'jingjitimer-history';

const pages = {};
document.querySelectorAll('.page').forEach(page => {
  pages[page.id.replace('page-', '')] = page;
});

let currentPage = 'results';
let filterRoom = '';
let filterDist = '';
let filterDate = '';
let toastTimer;

function msToDisplay(ms) {
  if (ms == null || ms < 0) return '-';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return m > 0
    ? `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
    : `${s}.${String(cs).padStart(2, '0')}`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(message, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

function loadLocalHistory() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (current.length) return current;
    return JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
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
  const localHistory = loadLocalHistory();
  if (serverHistory && (serverHistory.length || !localHistory.length)) return serverHistory;
  return localHistory;
}

function renderAdminTokenState() {
  const input = document.getElementById('admin-token-input');
  const status = document.getElementById('admin-token-status');
  const token = getStoredAdminToken();
  if (input && !input.value) input.value = token;
  if (status) status.textContent = token ? '已保存到本机浏览器' : '未设置';
}

function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');
  loaders[page]?.();
}

function filteredGroups(history) {
  return history.filter(group => {
    if (filterRoom && group.roomCode !== filterRoom) return false;
    if (filterDist && String(group.distance) !== String(filterDist)) return false;
    if (filterDate && !(group.date || '').startsWith(filterDate)) return false;
    return true;
  });
}

async function loadResults() {
  const history = await getHistory();
  const rooms = [...new Set(history.map(group => group.roomCode).filter(Boolean))].sort();
  const distances = [...new Set(history.map(group => group.distance).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  const dates = [...new Set(history.map(group => (group.date || '').slice(0, 10)).filter(Boolean))].sort().reverse();

  const roomSelect = document.getElementById('filter-room');
  const distSelect = document.getElementById('filter-dist');
  const dateSelect = document.getElementById('filter-date');
  const previous = {
    room: roomSelect?.value || filterRoom,
    dist: distSelect?.value || filterDist,
    date: dateSelect?.value || filterDate,
  };

  if (roomSelect) roomSelect.innerHTML = '<option value="">全部房间</option>' + rooms.map(room => `<option value="${esc(room)}">${esc(room)}</option>`).join('');
  if (distSelect) distSelect.innerHTML = '<option value="">全部距离</option>' + distances.map(distance => `<option value="${esc(distance)}">${esc(distance)} m</option>`).join('');
  if (dateSelect) dateSelect.innerHTML = '<option value="">全部日期</option>' + dates.map(date => `<option value="${esc(date)}">${esc(date)}</option>`).join('');

  if (roomSelect) roomSelect.value = previous.room;
  if (distSelect) distSelect.value = previous.dist;
  if (dateSelect) dateSelect.value = previous.date;
  filterRoom = roomSelect?.value || '';
  filterDist = distSelect?.value || '';
  filterDate = dateSelect?.value || '';

  renderResults(history);
}

function renderResults(history) {
  const tbody = document.querySelector('#results-table tbody');
  if (!tbody) return;

  const groups = filteredGroups(history).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  if (!groups.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty">暂无成绩记录</td></tr>';
    document.getElementById('result-count').textContent = '0 条成绩';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const rows = [];
  let totalCount = 0;

  groups.forEach(group => {
    const sorted = [...(group.results || [])].sort((a, b) => {
      if (a.isDNF && !b.isDNF) return 1;
      if (!a.isDNF && b.isDNF) return -1;
      return (a.raceTime ?? Infinity) - (b.raceTime ?? Infinity);
    });

    sorted.forEach((result, index) => {
      totalCount++;
      const rank = result.isDNF ? 'DNF' : (medals[index] || String(index + 1));
      rows.push(`<tr class="${index === 0 ? 'row-gold' : index === 1 ? 'row-silver' : index === 2 ? 'row-bronze' : ''}">
        <td>${rank}</td>
        <td class="time-cell">${result.isDNF ? 'DNF' : msToDisplay(result.raceTime)}</td>
        <td>${esc(result.name || `${result.laneIdx != null ? result.laneIdx + 1 : '?'}道`)}</td>
        <td>${result.laneIdx != null ? result.laneIdx + 1 : '-'}道</td>
        <td>${esc(group.distance)}m${group.laps > 1 ? ` x ${group.laps}圈` : ''}</td>
        <td>第${group.round || 1}轮 第${group.group || 1}组</td>
        <td>${esc(group.roomCode || '-')}</td>
        <td>${esc((group.date || '').slice(0, 10))}</td>
        <td><button class="btn-danger btn-sm" onclick="deleteGroup('${esc(group.id)}')">删除</button></td>
      </tr>`);
    });

    rows.push(`<tr class="group-sep"><td colspan="9">${esc(group.raceName || '比赛')} · 第${group.round || 1}轮第${group.group || 1}组 · ${esc(group.distance)}m · 房间 ${esc(group.roomCode || '-')} · ${esc((group.date || '').slice(0, 10))}</td></tr>`);
  });

  tbody.innerHTML = rows.join('');
  document.getElementById('result-count').textContent = `${totalCount} 条成绩`;
}

async function deleteGroupServerFirst(id) {
  if (!confirm('确认删除这组成绩？')) return;
  try {
    const res = await fetch(`/api/groups/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
    });
    if (res.ok) {
      await loadResults();
      toast('已删除', 'warn');
      return;
    }
  } catch {}

  const history = loadLocalHistory().filter(group => group.id !== id);
  saveLocalHistory(history);
  await loadResults();
  toast('已删除本机记录', 'warn');
}

window.deleteGroup = deleteGroupServerFirst;

function ensureLiveRoomsPanel() {
  if (document.getElementById('live-rooms-panel')) return;
  const overview = document.getElementById('page-overview');
  const recent = document.getElementById('recent-table');
  if (!overview || !recent) return;
  const panel = document.createElement('section');
  panel.id = 'live-rooms-panel';
  panel.className = 'live-rooms-panel';
  panel.innerHTML = `
    <div class="page-header">
      <h2>当前在线房间</h2>
      <span class="result-count" id="live-room-count">0</span>
    </div>
    <div id="live-rooms-list" class="live-rooms-list">
      <div class="empty">暂无在线设备</div>
    </div>`;
  overview.insertBefore(panel, recent);
}

async function fetchLiveRooms() {
  try {
    const res = await fetch('/api/live-rooms', {
      cache: 'no-store',
      headers: getAdminHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function roleLabel(role) {
  return {
    start: '发令端',
    finish: '终点端',
    observer: '成绩端',
    solo: '单机',
    unknown: '未知',
  }[role] || role;
}

function relativeSeconds(ms) {
  return `${Math.max(0, Math.round((ms || 0) / 1000))} 秒`;
}

function latencyLabel(ms) {
  if (ms === null || ms === undefined) return { text: '未校准', className: 'lat-unknown' };
  if (ms < 30) return { text: `优秀 ${ms}ms`, className: 'lat-good' };
  if (ms < 80) return { text: `可用 ${ms}ms`, className: 'lat-ok' };
  return { text: `偏高 ${ms}ms`, className: 'lat-bad' };
}

function renderLiveRooms(payload) {
  ensureLiveRoomsPanel();
  const list = document.getElementById('live-rooms-list');
  const count = document.getElementById('live-room-count');
  const rooms = payload?.rooms || [];
  if (count) count.textContent = `${rooms.length} 个房间`;
  if (!list) return;
  if (!rooms.length) {
    list.innerHTML = '<div class="empty">暂无在线设备</div>';
    return;
  }

  list.innerHTML = rooms.map(room => `
    <div class="live-room-card">
      <div class="live-room-head">
        <strong>房间 ${esc(room.roomCode)}</strong>
        <span>${room.clientCount} 台设备</span>
      </div>
      <div class="live-role-row">
        <span>发令 ${room.roleCounts.start || 0}</span>
        <span>终点 ${room.roleCounts.finish || 0}</span>
        <span>成绩 ${room.roleCounts.observer || 0}</span>
      </div>
      <div class="live-client-list">
        ${room.clients.map(client => {
          const latency = latencyLabel(client.latencyMs);
          return `
          <div class="live-client">
            <b>${roleLabel(client.role)}</b>
            <span>#${client.id}</span>
            <span class="live-latency ${latency.className}">${latency.text}</span>
            <span>在线 ${relativeSeconds(client.onlineMs)}</span>
            <span>空闲 ${relativeSeconds(client.idleMs)}</span>
            <span>消息 ${client.messages}</span>
          </div>
        `}).join('')}
      </div>
    </div>
  `).join('');
}

async function loadOverview() {
  const history = await getHistory();
  const liveRooms = await fetchLiveRooms();
  const totalGroups = history.length;
  const totalResults = history.reduce((sum, group) => sum + (group.results || []).length, 0);
  const totalRooms = liveRooms?.rooms?.length ?? new Set(history.map(group => group.roomCode).filter(Boolean)).size;
  const totalDists = new Set(history.map(group => group.distance).filter(Boolean)).size;

  document.getElementById('st-groups').textContent = totalGroups;
  document.getElementById('st-results').textContent = totalResults;
  document.getElementById('st-rooms').textContent = totalRooms;
  document.getElementById('st-dists').textContent = totalDists;
  renderLiveRooms(liveRooms);

  const tbody = document.querySelector('#recent-table tbody');
  if (!tbody) return;
  const recent = [...history].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 10);
  tbody.innerHTML = recent.map(group => {
    const best = (group.results || []).filter(result => !result.isDNF).sort((a, b) => a.raceTime - b.raceTime)[0];
    return `<tr>
      <td>${esc((group.date || '').slice(0, 10))}</td>
      <td>${esc(group.raceName || '比赛')}</td>
      <td>${esc(group.distance)}m</td>
      <td>第${group.round || 1}轮 第${group.group || 1}组</td>
      <td class="time-cell">${best ? msToDisplay(best.raceTime) : '-'}</td>
      <td>${esc(best?.name || '-')}</td>
      <td>${esc(group.roomCode || '-')}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" class="empty">暂无数据</td></tr>';
}

async function loadExport() {
  const history = await getHistory();
  const rooms = [...new Set(history.map(group => group.roomCode).filter(Boolean))].sort();
  const select = document.getElementById('exp-room');
  if (select) {
    select.innerHTML = '<option value="">全部</option>' + rooms.map(room => `<option value="${esc(room)}">${esc(room)}</option>`).join('');
  }
}

function exportCSV(groups) {
  const headers = ['日期', '房间', '比赛名称', '距离', '轮次', '组别', '排名', '姓名', '道次', '成绩(秒)', '成绩', '是否DNF'];
  const rows = [];

  groups.forEach(group => {
    const sorted = [...(group.results || [])].sort((a, b) => (a.raceTime ?? Infinity) - (b.raceTime ?? Infinity));
    sorted.forEach((result, index) => {
      rows.push([
        (group.date || '').slice(0, 10),
        group.roomCode || '',
        group.raceName || '比赛',
        group.distance,
        group.round || 1,
        group.group || 1,
        result.isDNF ? 'DNF' : index + 1,
        result.name || `${result.laneIdx != null ? result.laneIdx + 1 : '?'}道`,
        result.laneIdx != null ? result.laneIdx + 1 : '',
        result.isDNF ? '' : ((result.raceTime || 0) / 1000).toFixed(2),
        result.isDNF ? 'DNF' : msToDisplay(result.raceTime),
        result.isDNF ? '是' : '否',
      ].map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','));
    });
  });

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `jjcs成绩_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    showPage(link.dataset.page);
  });
});

document.getElementById('filter-room')?.addEventListener('change', async event => {
  filterRoom = event.target.value;
  renderResults(await getHistory());
});
document.getElementById('filter-dist')?.addEventListener('change', async event => {
  filterDist = event.target.value;
  renderResults(await getHistory());
});
document.getElementById('filter-date')?.addEventListener('change', async event => {
  filterDate = event.target.value;
  renderResults(await getHistory());
});
document.getElementById('btn-clear-filter')?.addEventListener('click', () => {
  filterRoom = filterDist = filterDate = '';
  loadResults();
});
document.getElementById('btn-clear-all')?.addEventListener('click', () => {
  if (!confirm('确认清除本机历史成绩？服务端成绩请逐组删除。')) return;
  saveLocalHistory([]);
  loadResults();
  toast('已清除本机历史成绩', 'warn');
});
document.getElementById('btn-exp-all')?.addEventListener('click', async () => {
  exportCSV(await getHistory());
  toast('已导出全部成绩');
});
document.getElementById('btn-exp-room')?.addEventListener('click', async () => {
  const room = document.getElementById('exp-room')?.value;
  const history = await getHistory();
  exportCSV(room ? history.filter(group => group.roomCode === room) : history);
  toast(room ? `已导出房间 ${room} 的成绩` : '已导出全部成绩');
});
document.getElementById('btn-refresh')?.addEventListener('click', () => {
  loaders[currentPage]?.();
  toast('已刷新');
});
document.getElementById('btn-save-admin-token')?.addEventListener('click', () => {
  const input = document.getElementById('admin-token-input');
  setStoredAdminToken(input?.value || '');
  renderAdminTokenState();
  toast('管理员令牌已保存');
});
document.getElementById('btn-clear-admin-token')?.addEventListener('click', () => {
  const input = document.getElementById('admin-token-input');
  if (input) input.value = '';
  setStoredAdminToken('');
  renderAdminTokenState();
  toast('管理员令牌已清除', 'warn');
});

const loaders = {
  overview: loadOverview,
  results: loadResults,
  export: loadExport,
};

renderAdminTokenState();
showPage('results');
