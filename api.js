import { readDB, writeDB, insertRecord, updateRecord, deleteRecord, findById } from './db.js';
import QRCode from 'qrcode';
import { BACKUP_COLLECTIONS, buildBackupPayload } from './lib/backup.js';
import { buildResultGroups, parseResultGroupId } from './lib/result-groups.js';
import { isAuthorizedRequest, isMutatingMethod } from './lib/security.js';

// ── helpers ──────────────────────────────────────────────────────────────────
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
function err(res, msg, status = 400) { json(res, { error: msg }, status); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let rejected = false;
    req.on('data', chunk => {
      if (rejected) return;
      body += chunk;
      if (body.length > 1e6) {
        rejected = true;
        reject(Object.assign(new Error('payload too large'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('aborted', () => {
      if (!rejected) reject(Object.assign(new Error('request aborted'), { statusCode: 400 }));
    });
    req.on('end', () => {
      if (rejected) return;
      try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function msToDisplay(ms) {
  if (!ms && ms !== 0) return '';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const c = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2,'0')}.${String(c).padStart(2,'0')}`;
}

// ── router ───────────────────────────────────────────────────────────────────
export async function handleAPI(req, res) {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.replace(/^\/api/, '').split('/').filter(Boolean);
  const method = req.method.toUpperCase();
  const adminToken = process.env.ADMIN_TOKEN || '';

  if (isMutatingMethod(method) && !isAuthorizedRequest(req, adminToken)) {
    return err(res, 'unauthorized', 401);
  }

  // POST /api/meets
  // GET  /api/meets
  // GET  /api/meets/:id
  // PUT  /api/meets/:id
  // DELETE /api/meets/:id

  try {
    if (parts[0] === 'qr' && method === 'GET') {
      const data = url.searchParams.get('data') || '';
      if (!data || data.length > 2048) return err(res, 'invalid qr data');
      const svg = await QRCode.toString(data, {
        type: 'svg',
        margin: 1,
        width: 180,
        errorCorrectionLevel: 'M',
      });
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      return res.end(svg);
    }

    // ── meets ──────────────────────────────────────────────────────────────
    if (parts[0] === 'meets') {
      if (method === 'GET' && !parts[1]) {
        return json(res, readDB('meets').reverse());
      }
      if (method === 'POST') {
        const b = await readBody(req);
        if (!b.name) return err(res, 'name required');
        const meet = insertRecord('meets', {
          name: b.name,
          date: b.date || new Date().toISOString().slice(0,10),
          location: b.location || '',
          notes: b.notes || '',
        });
        return json(res, meet, 201);
      }
      if (parts[1]) {
        const id = Number(parts[1]);
        if (method === 'GET') {
          const meet = findById(readDB('meets'), id);
          return meet ? json(res, meet) : err(res, 'not found', 404);
        }
        if (method === 'PUT') {
          const b = await readBody(req);
          const updated = updateRecord('meets', id, b);
          return updated ? json(res, updated) : err(res, 'not found', 404);
        }
        if (method === 'DELETE') {
          deleteRecord('meets', id);
          return json(res, { ok: true });
        }
      }
    }

    // ── events ─────────────────────────────────────────────────────────────
    if (parts[0] === 'events') {
      if (method === 'GET' && !parts[1]) {
        let events = readDB('events');
        if (url.searchParams.get('meetId')) {
          events = events.filter(e => e.meetId === Number(url.searchParams.get('meetId')));
        }
        return json(res, events);
      }
      if (method === 'POST') {
        const b = await readBody(req);
        if (!b.name || !b.meetId) return err(res, 'name and meetId required');
        const ev = insertRecord('events', {
          meetId:        Number(b.meetId),
          name:          b.name,
          distance:      b.distance || '',
          laps:          Number(b.laps) || 1,
          totalRounds:   Number(b.totalRounds) || 1,
          groupsPerRound:Number(b.groupsPerRound) || 1,
          advanceCount:  Number(b.advanceCount) || 0,
          gender:        b.gender || 'mixed',
          windSpeed:     b.windSpeed || null,
        });
        return json(res, ev, 201);
      }
      if (parts[1]) {
        const id = Number(parts[1]);
        if (method === 'GET') {
          const ev = findById(readDB('events'), id);
          return ev ? json(res, ev) : err(res, 'not found', 404);
        }
        if (method === 'PUT') {
          const b = await readBody(req);
          const updated = updateRecord('events', id, b);
          return updated ? json(res, updated) : err(res, 'not found', 404);
        }
        if (method === 'DELETE') {
          deleteRecord('events', id);
          return json(res, { ok: true });
        }
      }
    }

    // ── athletes ───────────────────────────────────────────────────────────
    if (parts[0] === 'athletes') {
      if (method === 'GET' && !parts[1]) {
        let athletes = readDB('athletes');
        if (url.searchParams.get('q')) {
          const q = url.searchParams.get('q').toLowerCase();
          athletes = athletes.filter(a =>
            a.name?.toLowerCase().includes(q) ||
            a.number?.toLowerCase().includes(q) ||
            a.team?.toLowerCase().includes(q)
          );
        }
        return json(res, athletes);
      }
      if (method === 'POST') {
        const b = await readBody(req);
        if (!b.name) return err(res, 'name required');
        const ath = insertRecord('athletes', {
          name:   b.name,
          number: b.number || '',
          team:   b.team || '',
          gender: b.gender || '',
          dob:    b.dob || '',
        });
        return json(res, ath, 201);
      }
      if (method === 'PUT' && parts[1]) {
        const b = await readBody(req);
        const updated = updateRecord('athletes', Number(parts[1]), b);
        return updated ? json(res, updated) : err(res, 'not found', 404);
      }
      if (method === 'DELETE' && parts[1]) {
        deleteRecord('athletes', Number(parts[1]));
        return json(res, { ok: true });
      }
    }

    // ── results ────────────────────────────────────────────────────────────
    if (parts[0] === 'results') {
      if (method === 'GET' && !parts[1]) {
        let results = readDB('results');
        if (url.searchParams.get('eventId')) {
          results = results.filter(r => r.eventId === Number(url.searchParams.get('eventId')));
        }
        if (url.searchParams.get('meetId')) {
          const events = readDB('events').filter(e => e.meetId === Number(url.searchParams.get('meetId')));
          const eids = new Set(events.map(e => e.id));
          results = results.filter(r => eids.has(r.eventId));
        }
        return json(res, results);
      }
      if (method === 'POST') {
        const b = await readBody(req);
        if (!b.eventId) return err(res, 'eventId required');
        const result = insertRecord('results', {
          eventId:      Number(b.eventId),
          round:        Number(b.round) || 1,
          group:        Number(b.group) || 1,
          athleteName:  b.athleteName || '',
          athleteId:    b.athleteId ? Number(b.athleteId) : null,
          number:       b.number || '',
          team:         b.team || '',
          laneIndex:    b.laneIndex ?? null,
          timeMs:       b.timeMs ?? null,
          lapTimes:     b.lapTimes || [],
          rank:         b.rank ?? null,
          qualified:    b.qualified ?? false,
          windSpeed:    b.windSpeed ?? null,
          videoOffset:  b.videoOffset ?? null,
          notes:        b.notes || '',
          recordedAt:   b.recordedAt || Date.now(),
        });
        return json(res, result, 201);
      }
      if (parts[1]) {
        const id = Number(parts[1]);
        if (method === 'PUT') {
          const b = await readBody(req);
          const updated = updateRecord('results', id, b);
          return updated ? json(res, updated) : err(res, 'not found', 404);
        }
        if (method === 'DELETE') {
          deleteRecord('results', id);
          return json(res, { ok: true });
        }
      }
    }

    // ── stats ──────────────────────────────────────────────────────────────
    if (parts[0] === 'stats' && method === 'GET') {
      const meets    = readDB('meets');
      const events   = readDB('events');
      const athletes = readDB('athletes');
      const results  = readDB('results');

      const byEvent = {};
      results.forEach(r => {
        if (!byEvent[r.eventId]) byEvent[r.eventId] = [];
        byEvent[r.eventId].push(r);
      });

      // Best time per event
      const eventBests = events.map(ev => {
        const evResults = (byEvent[ev.id] || []).filter(r => r.timeMs);
        evResults.sort((a, b) => a.timeMs - b.timeMs);
        return {
          eventId: ev.id,
          eventName: ev.name,
          best: evResults[0] || null,
          count: evResults.length,
        };
      });

      return json(res, {
        totalMeets:    meets.length,
        totalEvents:   events.length,
        totalAthletes: athletes.length,
        totalResults:  results.length,
        eventBests,
      });
    }

    // ── admin-compatible result groups ─────────────────────────────────────
    if (parts[0] === 'groups' && method === 'GET') {
      return json(res, buildResultGroups({
        meets: readDB('meets'),
        events: readDB('events'),
        results: readDB('results'),
      }));
    }
    if (parts[0] === 'groups' && method === 'DELETE' && parts[1]) {
      const groupId = parseResultGroupId(parts[1]);
      if (!groupId) return err(res, 'invalid group id');

      const results = readDB('results');
      const kept = results.filter(result =>
        Number(result.eventId) !== groupId.eventId ||
        Number(result.round || 1) !== groupId.round ||
        Number(result.group || 1) !== groupId.group
      );
      writeDB('results', kept);
      return json(res, { ok: true, deleted: results.length - kept.length });
    }

    // ── backup export ──────────────────────────────────────────────────────
    if (parts[0] === 'backup' && method === 'GET') {
      const collections = Object.fromEntries(
        BACKUP_COLLECTIONS.map(name => [name, readDB(name)])
      );
      const payload = buildBackupPayload(collections);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="jjcs-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      });
      return res.end(JSON.stringify(payload, null, 2));
    }

    // ── export CSV ─────────────────────────────────────────────────────────
    if (parts[0] === 'export' && parts[1] === 'csv' && method === 'GET') {
      const meetId  = url.searchParams.get('meetId');
      const eventId = url.searchParams.get('eventId');

      let results = readDB('results');
      let events  = readDB('events');
      const meets = readDB('meets');

      if (eventId) {
        results = results.filter(r => r.eventId === Number(eventId));
        events  = events.filter(e => e.id === Number(eventId));
      } else if (meetId) {
        const eids = new Set(events.filter(e => e.meetId === Number(meetId)).map(e => e.id));
        results = results.filter(r => eids.has(r.eventId));
        events  = events.filter(e => e.meetId === Number(meetId));
      }

      const evMap   = Object.fromEntries(events.map(e => [e.id, e]));
      const meetMap = Object.fromEntries(meets.map(m => [m.id, m]));

      const headers = ['赛事', '项目', '轮次', '组别', '姓名', '号码', '单位', '道次', '时间', '成绩(ms)', '圈次成绩', '排名', '晋级', '记录时间'];
      const rows = results.map(r => {
        const ev   = evMap[r.eventId] || {};
        const meet = meetMap[ev.meetId] || {};
        return [
          meet.name || '',
          ev.name || '',
          r.round,
          r.group,
          r.athleteName,
          r.number,
          r.team,
          r.laneIndex != null ? r.laneIndex + 1 : '',
          msToDisplay(r.timeMs),
          r.timeMs ?? '',
          (r.lapTimes || []).map(msToDisplay).join(' | '),
          r.rank ?? '',
          r.qualified ? '是' : '否',
          r.recordedAt ? new Date(r.recordedAt).toISOString() : '',
        ].map(csvEscape);
      });

      const bom = '﻿';
      const csv = bom + [headers.map(csvEscape), ...rows].map(r => r.join(',')).join('\r\n');

      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="jjcs-results.csv"',
      });
      return res.end(csv);
    }

    // ── rank/reorder ────────────────────────────────────────────────────────
    if (parts[0] === 'rank' && method === 'POST') {
      const b = await readBody(req);
      const { eventId, round, group } = b;
      if (!eventId) return err(res, 'eventId required');

      const results = readDB('results');
      const filtered = results.filter(r =>
        r.eventId === Number(eventId) &&
        (round == null || r.round === Number(round)) &&
        (group == null || r.group === Number(group)) &&
        r.timeMs != null
      );
      filtered.sort((a, b) => a.timeMs - b.timeMs);
      const ev = findById(readDB('events'), Number(eventId));
      const advanceCount = ev?.advanceCount || 0;

      filtered.forEach((r, i) => {
        updateRecord('results', r.id, {
          rank: i + 1,
          qualified: advanceCount > 0 ? (i < advanceCount) : false,
        });
      });

      return json(res, { ranked: filtered.length });
    }

    err(res, 'not found', 404);
  } catch (e) {
    console.error('[API]', e);
    err(res, e.message === 'payload too large' ? 'payload too large' : 'internal error', e.statusCode || 500);
  }
}
