import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveRoomSnapshot } from '../lib/live-rooms.js';

test('buildLiveRoomSnapshot summarizes active rooms and roles', () => {
  const rooms = new Map([
    ['4821', [
      { id: 1, role: 'start', joinedAt: 1000, lastSeenAt: 1800, messages: 3, latencyMs: 18, remoteAddress: '1.1.1.1', userAgent: 'Chrome' },
      { id: 2, role: 'finish', joinedAt: 1200, lastSeenAt: 1900, messages: 8 },
      { id: 3, role: 'observer', joinedAt: 1300, lastSeenAt: 1700 },
    ]],
  ]);

  const snapshot = buildLiveRoomSnapshot(rooms, 2000);

  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].roomCode, '4821');
  assert.equal(snapshot[0].clientCount, 3);
  assert.equal(snapshot[0].roleCounts.start, 1);
  assert.equal(snapshot[0].roleCounts.finish, 1);
  assert.equal(snapshot[0].roleCounts.observer, 1);
  assert.equal(snapshot[0].clients[0].onlineMs, 1000);
  assert.equal(snapshot[0].clients[1].idleMs, 100);
  assert.equal(snapshot[0].clients[0].latencyMs, 18);
  assert.equal('remoteAddress' in snapshot[0].clients[0], false);
  assert.equal('userAgent' in snapshot[0].clients[0], false);
});

test('buildLiveRoomSnapshot omits empty rooms', () => {
  const rooms = new Map([['empty', []]]);

  assert.deepEqual(buildLiveRoomSnapshot(rooms, 2000), []);
});

test('buildLiveRoomSnapshot normalizes unknown roles', () => {
  const rooms = new Map([['room-a', [{ id: 9, role: 'timer', joinedAt: 1000 }]]]);

  const [room] = buildLiveRoomSnapshot(rooms, 2000);

  assert.equal(room.roleCounts.unknown, 1);
  assert.equal(room.clients[0].role, 'unknown');
});
