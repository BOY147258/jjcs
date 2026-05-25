import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  deleteRecord,
  getDataDir,
  insertRecord,
  readDB,
  updateRecord,
  writeDB,
} from '../db.js';

function withTempDataDir(fn) {
  const previous = process.env.DATA_DIR;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jjcs-db-'));
  process.env.DATA_DIR = dir;
  try {
    return fn(dir);
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('uses DATA_DIR when configured', () => withTempDataDir(dir => {
  assert.equal(getDataDir(), dir);
}));

test('writes and reads records atomically', () => withTempDataDir(() => {
  writeDB('meets', [{ id: 1, name: 'Meet A' }]);
  assert.deepEqual(readDB('meets'), [{ id: 1, name: 'Meet A' }]);
}));

test('returns empty array for corrupt JSON instead of crashing', () => withTempDataDir(dir => {
  fs.writeFileSync(path.join(dir, 'results.json'), '{bad json', 'utf8');
  assert.deepEqual(readDB('results'), []);
}));

test('rejects unsafe collection names', () => withTempDataDir(() => {
  assert.throws(() => readDB('../secret'), /Invalid collection name/);
  assert.throws(() => writeDB('bad/name', []), /Invalid collection name/);
}));

test('insert, update, and delete record lifecycle', () => withTempDataDir(() => {
  const created = insertRecord('athletes', { name: 'Runner' });
  assert.equal(created.id, 1);
  assert.equal(typeof created.createdAt, 'number');

  const updated = updateRecord('athletes', created.id, { team: 'A' });
  assert.equal(updated.team, 'A');
  assert.equal(typeof updated.updatedAt, 'number');

  assert.equal(deleteRecord('athletes', created.id), true);
  assert.deepEqual(readDB('athletes'), []);
}));
