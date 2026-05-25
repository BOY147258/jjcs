import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBackupPayload } from '../lib/backup.js';

test('builds a versioned backup payload with all core collections', () => {
  const payload = buildBackupPayload({
    meets: [{ id: 1 }],
    events: [{ id: 2 }],
    athletes: [{ id: 3 }],
    results: [{ id: 4 }],
  }, { now: () => 1710000000000 });

  assert.equal(payload.version, 1);
  assert.equal(payload.exportedAt, '2024-03-09T16:00:00.000Z');
  assert.deepEqual(Object.keys(payload.collections), ['meets', 'events', 'athletes', 'results']);
  assert.deepEqual(payload.collections.results, [{ id: 4 }]);
});
