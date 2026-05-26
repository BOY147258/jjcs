import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('render blueprint is configured for persistent public deployment', () => {
  const renderYaml = fs.readFileSync('render.yaml', 'utf8');

  assert.match(renderYaml, /runtime:\s*node/);
  assert.match(renderYaml, /healthCheckPath:\s*\/ping/);
  assert.match(renderYaml, /mountPath:\s*\/opt\/render\/project\/src\/data/);
  assert.match(renderYaml, /key:\s*DATA_DIR/);
  assert.match(renderYaml, /key:\s*ADMIN_TOKEN/);
});

test('dockerfile exposes the app with persistent data outside the image', () => {
  const dockerfile = fs.readFileSync('Dockerfile', 'utf8');

  assert.match(dockerfile, /FROM node:20-alpine/);
  assert.match(dockerfile, /ENV DATA_DIR=\/data/);
  assert.match(dockerfile, /EXPOSE 8080/);
  assert.match(dockerfile, /CMD \["npm", "start"\]/);
});
