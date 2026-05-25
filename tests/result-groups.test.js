import test from 'node:test';
import assert from 'node:assert/strict';

import { buildResultGroups, parseResultGroupId } from '../lib/result-groups.js';

test('builds admin-compatible groups from stored meets, events, and results', () => {
  const groups = buildResultGroups({
    meets: [{ id: 1, name: 'Spring Meet' }],
    events: [{ id: 10, meetId: 1, name: '100m Boys', distance: 100, laps: 1 }],
    results: [
      {
        id: 101,
        eventId: 10,
        round: 1,
        group: 2,
        athleteName: 'Li Ming',
        laneIndex: 1,
        timeMs: 12340,
        rank: 1,
        recordedAt: 1710000000000,
      },
      {
        id: 102,
        eventId: 10,
        round: 1,
        group: 2,
        athleteName: 'Wang Lei',
        laneIndex: 2,
        timeMs: null,
        rank: null,
        recordedAt: 1710000001000,
      },
    ],
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, '10-1-2');
  assert.equal(groups[0].meetName, 'Spring Meet');
  assert.equal(groups[0].raceName, '100m Boys');
  assert.equal(groups[0].distance, 100);
  assert.equal(groups[0].laps, 1);
  assert.equal(groups[0].round, 1);
  assert.equal(groups[0].group, 2);
  assert.equal(groups[0].results.length, 2);
  assert.deepEqual(groups[0].results[0], {
    id: 101,
    laneIdx: 1,
    name: 'Li Ming',
    raceTime: 12340,
    isDNF: false,
    rank: 1,
    team: '',
    number: '',
  });
  assert.equal(groups[0].results[1].isDNF, true);
});

test('sorts groups by newest recorded result first', () => {
  const groups = buildResultGroups({
    meets: [],
    events: [
      { id: 1, name: 'First', distance: 100 },
      { id: 2, name: 'Second', distance: 200 },
    ],
    results: [
      { id: 1, eventId: 1, round: 1, group: 1, athleteName: 'A', recordedAt: 1000 },
      { id: 2, eventId: 2, round: 1, group: 1, athleteName: 'B', recordedAt: 2000 },
    ],
  });

  assert.deepEqual(groups.map(g => g.raceName), ['Second', 'First']);
});

test('parses result group ids for server-side deletion', () => {
  assert.deepEqual(parseResultGroupId('10-2-3'), { eventId: 10, round: 2, group: 3 });
  assert.equal(parseResultGroupId('bad-value'), null);
  assert.equal(parseResultGroupId('10-0-1'), null);
});
