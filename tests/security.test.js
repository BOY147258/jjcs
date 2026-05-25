import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  isAuthorizedRequest,
  isOriginAllowed,
  isSafeStaticPath,
  isValidRoomCode,
  normalizeAllowedOrigins,
} from '../lib/security.js';

test('normalizes comma-separated allowed origins', () => {
  assert.deepEqual(
    normalizeAllowedOrigins(' https://a.example,https://b.example ,, '),
    ['https://a.example', 'https://b.example'],
  );
});

test('allows any origin when no allowlist is configured', () => {
  assert.equal(isOriginAllowed('https://example.com', []), true);
  assert.equal(isOriginAllowed(undefined, []), true);
});

test('matches origins against explicit allowlist', () => {
  const allowlist = ['https://jjcs.example.com'];

  assert.equal(isOriginAllowed('https://jjcs.example.com', allowlist), true);
  assert.equal(isOriginAllowed('https://other.example.com', allowlist), false);
});

test('rejects unsafe static paths outside the project root', () => {
  const root = path.resolve('C:/app/jjcs');

  assert.equal(isSafeStaticPath(root, path.join(root, 'index.html')), true);
  assert.equal(isSafeStaticPath(root, path.resolve('C:/app/jjcs2/index.html')), false);
  assert.equal(isSafeStaticPath(root, path.resolve('C:/app/secret.txt')), false);
});

test('validates room codes used for device pairing', () => {
  assert.equal(isValidRoomCode('1234'), true);
  assert.equal(isValidRoomCode('room_2026'), true);
  assert.equal(isValidRoomCode(''), false);
  assert.equal(isValidRoomCode('../secret'), false);
  assert.equal(isValidRoomCode('x'.repeat(33)), false);
});

test('permits writes when no admin token is configured', () => {
  const req = { headers: {} };
  assert.equal(isAuthorizedRequest(req, ''), true);
});

test('requires bearer or x-admin-token when admin token is configured', () => {
  assert.equal(isAuthorizedRequest({ headers: {} }, 'secret'), false);
  assert.equal(isAuthorizedRequest({ headers: { authorization: 'Bearer secret' } }, 'secret'), true);
  assert.equal(isAuthorizedRequest({ headers: { 'x-admin-token': 'secret' } }, 'secret'), true);
  assert.equal(isAuthorizedRequest({ headers: { authorization: 'Bearer wrong' } }, 'secret'), false);
});
