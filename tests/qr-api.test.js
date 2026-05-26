import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAPI } from '../api.js';

function createResponse() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body = '') {
      this.body = String(body);
    },
  };
}

test('GET /api/qr returns a local SVG QR code', async () => {
  const req = {
    method: 'GET',
    url: '/api/qr?data=https%3A%2F%2Fjjcs.onrender.com%2F%3Frole%3Dfinish%26room%3D1234',
  };
  const res = createResponse();

  await handleAPI(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'image/svg+xml; charset=utf-8');
  assert.match(res.body, /^<svg/);
});

test('GET /api/qr rejects empty data', async () => {
  const req = { method: 'GET', url: '/api/qr' };
  const res = createResponse();

  await handleAPI(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body, /invalid qr data/);
});
