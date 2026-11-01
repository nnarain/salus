const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');

const root = resolve(__dirname, '..');
const executable = process.env.COMPOSE_BINARY || 'docker';
const prefix = process.env.COMPOSE_BINARY ? [] : ['compose'];
const available = spawnSync(executable, [...prefix, 'version'], { encoding: 'utf8' }).status === 0;

function configuration(development = false, environment = {}) {
  const files = ['-f', resolve(root, 'docker-compose.yml')];
  if (development) files.push('-f', resolve(root, 'docker-compose.dev.yml'));
  const result = spawnSync(executable, [...prefix, ...files, 'config', '--format', 'json'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      POSTGRES_PASSWORD: 'test_password',
      APP_BIND_ADDRESS: '127.0.0.1',
      APP_PORT: '3000',
      POSTGRES_PORT: '5432',
      ...environment,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('production Compose has two services with a private database and fresh volume', { skip: !available }, () => {
  const config = configuration();
  assert.deepEqual(Object.keys(config.services).sort(), ['app', 'db']);
  assert.equal(config.services.db.image, 'postgres:17-bookworm');
  assert.equal(config.services.db.ports?.length || 0, 0);
  assert.deepEqual(Object.keys(config.services.db.networks), ['database']);
  assert.equal(config.networks.database.internal, true);
  assert.equal(config.services.db.volumes.length, 1);
  assert.equal(config.services.db.volumes[0].source, 'postgres-data');
  assert.equal(config.services.db.volumes[0].target, '/var/lib/postgresql/data');
  assert.equal(Object.hasOwn(config.volumes, 'db-data'), false);
  assert.equal(config.services.app.depends_on.db.condition, 'service_healthy');
  assert.deepEqual(Object.keys(config.services.app.environment), ['DATABASE_URL']);
  const url = new URL(config.services.app.environment.DATABASE_URL);
  assert.equal(url.hostname, 'db');
  assert.equal(url.port, '5432');
  assert.equal(url.password, 'test_password');
  assert.equal(config.services.app.init, true);
  assert.equal(config.services.app.ports[0].host_ip, '127.0.0.1');
  assert.equal(config.services.app.ports[0].published, '3000');
  assert.equal(config.services.app.ports[0].target, 3000);
  assert.equal(Object.hasOwn(config.services.app, 'container_name'), false);
});

test('development override retains two services and uses isolated source/dependency mounts', { skip: !available }, () => {
  const config = configuration(true);
  assert.deepEqual(Object.keys(config.services).sort(), ['app', 'db']);
  assert.equal(config.services.app.build.target, 'deps');
  assert.equal(config.services.app.environment.NODE_ENV, 'development');
  assert.equal(new URL(config.services.app.environment.DATABASE_URL).hostname, 'db');
  assert.equal(config.services.db.ports[0].host_ip, '127.0.0.1');
  assert.equal(config.services.db.ports[0].published, '5432');
  assert.equal(Object.hasOwn(config.services.db.networks, 'default'), true);
  assert.equal(Object.hasOwn(config.services.db.networks, 'database'), true);
  assert.match(config.services.app.command.join(' '), /npm ci.*exec npm run dev/);
  assert.equal(config.services.app.volumes.find((volume) => volume.target === '/app').type, 'bind');
  for (const target of ['/app/node_modules', '/app/.next']) {
    assert.equal(config.services.app.volumes.find((volume) => volume.target === target).type, 'volume');
  }
});

test('deployment ports and private-LAN app binding can be explicitly configured', { skip: !available }, () => {
  const config = configuration(true, {
    APP_BIND_ADDRESS: '192.168.1.10', APP_PORT: '3100', POSTGRES_PORT: '5433',
  });
  assert.equal(config.services.app.ports[0].host_ip, '192.168.1.10');
  assert.equal(config.services.app.ports[0].published, '3100');
  assert.equal(config.services.db.ports[0].host_ip, '127.0.0.1');
  assert.equal(config.services.db.ports[0].published, '5433');
});

test('production Dockerfile packages migration-first standalone startup on maintained Node', () => {
  const dockerfile = readFileSync(resolve(root, 'Dockerfile'), 'utf8');
  assert.match(dockerfile, /^FROM node:24-bookworm-slim AS base/m);
  assert.match(dockerfile, /\/app\/scripts\/migrate\.mjs \.\/scripts\/migrate\.mjs/);
  assert.match(dockerfile, /\/app\/db\/migrations \.\/db\/migrations/);
  assert.match(dockerfile, /await import\('\.\/scripts\/migrate\.mjs'\)/);
  assert.match(dockerfile, /USER nextjs/);
  assert.match(dockerfile, /node scripts\/migrate\.mjs && exec node server\.js/);
  assert.equal(readFileSync(resolve(root, '.dockerignore'), 'utf8').split('\n').includes('.env*'), true);
});

test('staged standalone runtime imports migration dependencies and fails clearly without database configuration', {
  skip: !process.env.RUNTIME_CHECK_DIR,
}, async () => {
  const script = resolve(process.env.RUNTIME_CHECK_DIR, 'scripts/migrate.mjs');
  await import(pathToFileURL(script));
  const result = spawnSync(process.execPath, [script], {
    env: { ...process.env, DATABASE_URL: '' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DATABASE_URL must be set/);
  assert.equal(result.stderr.includes('Cannot find'), false);
});