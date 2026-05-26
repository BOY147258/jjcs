import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAdminHeaders,
  normalizeAdminToken,
  readAdminTokenFromStorageValue,
} from '../js/admin-auth.js';

test('normalizes admin token input', () => {
  assert.equal(normalizeAdminToken('  secret  '), 'secret');
  assert.equal(normalizeAdminToken(null), '');
});

test('builds empty headers when no token is present', () => {
  assert.deepEqual(buildAdminHeaders(''), {});
});

test('builds bearer and x-admin-token headers when token is present', () => {
  assert.deepEqual(buildAdminHeaders('secret'), {
    Authorization: 'Bearer secret',
    'X-Admin-Token': 'secret',
  });
});

test('reads admin token from storage value', () => {
  assert.equal(readAdminTokenFromStorageValue('"secret"'), 'secret');
  assert.equal(readAdminTokenFromStorageValue('not-json'), '');
  assert.equal(readAdminTokenFromStorageValue(''), '');
});
