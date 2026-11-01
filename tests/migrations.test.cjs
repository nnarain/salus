const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { test } = require('node:test');
const pg = require('pg');

async function fixture(context, files = { '001_first.sql': 'SELECT 1;', '002_second.sql': 'SELECT 2;' }) {
  const directory = await mkdtemp(join(tmpdir(), 'health-tracker-migrations-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  for (const [filename, sql] of Object.entries(files)) {
    await writeFile(join(directory, filename), sql);
  }
  const { applyMigrations } = await import('../scripts/migrate.mjs');
  const calls = [];
  const applied = [];
  let pending = [];
  const client = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (text === 'SELECT filename, checksum FROM schema_migrations') return { rows: applied };
      if (text.startsWith('INSERT INTO schema_migrations')) {
        pending.push({ filename: values[0], checksum: values[1] });
      }
      if (text === 'COMMIT') {
        applied.push(...pending);
        pending = [];
      }
      if (text === 'ROLLBACK') pending = [];
      if (text === 'BROKEN SQL;') throw new Error('SQL failed');
      return { rows: [] };
    },
  };
  return { directory, calls, applied, client, run: () => applyMigrations(client, directory) };
}

test('migrations lock execution and commit SQL plus ledger entries in filename order', async (context) => {
  const state = await fixture(context, { '002_second.sql': 'SELECT 2;', '001_first.sql': 'SELECT 1;' });
  await state.run();
  assert.equal(state.calls[0].text, 'SELECT pg_advisory_lock($1)');
  assert.equal(state.calls.at(-1).text, 'SELECT pg_advisory_unlock($1)');
  assert.deepEqual(state.calls[0].values, state.calls.at(-1).values);
  assert.deepEqual(state.applied.map((row) => row.filename), ['001_first.sql', '002_second.sql']);
  const transactionCalls = state.calls.slice(3, -1).map((call) => call.text);
  assert.deepEqual(transactionCalls, [
    'BEGIN', 'SELECT 1;', 'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', 'COMMIT',
    'BEGIN', 'SELECT 2;', 'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', 'COMMIT',
  ]);
});

test('repeat startup skips applied files and applies only newly added migrations', async (context) => {
  const state = await fixture(context);
  await state.run();
  state.calls.length = 0;
  await state.run();
  assert.equal(state.calls.some((call) => call.text === 'BEGIN'), false);
  await writeFile(join(state.directory, '003_third.sql'), 'SELECT 3;');
  state.calls.length = 0;
  await state.run();
  assert.equal(state.calls.filter((call) => call.text === 'BEGIN').length, 1);
  assert.equal(state.applied.at(-1).filename, '003_third.sql');
});

test('failed migration rolls back, is not recorded, and stops before later files', async (context) => {
  const state = await fixture(context, {
    '001_first.sql': 'SELECT 1;',
    '002_broken.sql': 'BROKEN SQL;',
    '003_later.sql': 'SELECT 3;',
  });
  await assert.rejects(state.run(), /SQL failed/);
  assert.deepEqual(state.applied.map((row) => row.filename), ['001_first.sql']);
  assert.equal(state.calls.some((call) => call.text === 'ROLLBACK'), true);
  assert.equal(state.calls.some((call) => call.text === 'SELECT 3;'), false);
  assert.equal(state.calls.at(-1).text, 'SELECT pg_advisory_unlock($1)');
});

test('changed applied SQL is rejected before any new transaction', async (context) => {
  const state = await fixture(context);
  await state.run();
  await writeFile(join(state.directory, '001_first.sql'), 'SELECT 999;');
  state.calls.length = 0;
  await assert.rejects(state.run(), /Applied migration is missing or changed/);
  assert.equal(state.calls.some((call) => call.text === 'BEGIN'), false);
  assert.equal(state.calls.at(-1).text, 'SELECT pg_advisory_unlock($1)');
});

test('duplicate migration versions are rejected before touching the database', async (context) => {
  const state = await fixture(context, { '003_first.sql': 'SELECT 1;', '003_second.sql': 'SELECT 2;' });
  await assert.rejects(state.run(), /Duplicate migration version/);
  assert.equal(state.calls.length, 0);
});

test('invalid migration names and empty directories fail clearly', async (context) => {
  const invalid = await fixture(context, { 'unversioned.sql': 'SELECT 1;' });
  await assert.rejects(invalid.run(), /Invalid migration filename/);
  const empty = await fixture(context, {});
  await assert.rejects(empty.run(), /No database migrations found/);
});

test('migration versions are sorted numerically even without leading zeros', async (context) => {
  const state = await fixture(context, { '10_tenth.sql': 'SELECT 10;', '2_second.sql': 'SELECT 2;' });
  await state.run();
  assert.deepEqual(state.applied.map((row) => row.filename), ['2_second.sql', '10_tenth.sql']);
});

for (const command of ['dev', 'start']) {
  test(`npm ${command} does not launch Next.js when migration configuration is missing`, () => {
    const result = spawnSync('npm', ['run', command], {
      cwd: resolve(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: '' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DATABASE_URL must be set/);
    assert.equal(result.stdout.includes(`> next ${command}`), false);
  });
}

test('real PostgreSQL serializes runners, applies pending files, and rolls back failed SQL', {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  const state = await fixture(context, {
    '001_first.sql': 'CREATE TABLE migration_first (id INTEGER);',
    '002_second.sql': 'CREATE TABLE migration_second (id INTEGER);',
  });
  const { applyMigrations } = await import('../scripts/migrate.mjs');
  const schema = `migration_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  const clients = [];
  await admin.connect();
  context.after(async () => {
    try {
      await Promise.all(clients.map((client) => client.end()));
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin.end();
    }
  });
  await admin.query(`CREATE SCHEMA ${schema}`);
  for (let count = 0; count < 2; count++) {
    const client = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    clients.push(client);
    await client.connect();
  }
  await Promise.all(clients.map((client) => applyMigrations(client, state.directory)));
  const before = await clients[0].query('SELECT * FROM schema_migrations ORDER BY filename');
  assert.equal(before.rows.length, 2);
  await applyMigrations(clients[0], state.directory);
  const after = await clients[0].query('SELECT * FROM schema_migrations ORDER BY filename');
  assert.deepEqual(after.rows, before.rows);

  await writeFile(join(state.directory, '003_third.sql'), 'CREATE TABLE migration_third (id INTEGER);');
  await applyMigrations(clients[0], state.directory);
  assert.equal((await clients[0].query('SELECT * FROM schema_migrations')).rows.length, 3);

  await writeFile(join(state.directory, '004_broken.sql'),
    'CREATE TABLE rollback_probe (id INTEGER); SELECT * FROM missing_migration_table;');
  await assert.rejects(applyMigrations(clients[0], state.directory), /missing_migration_table/);
  assert.equal((await clients[0].query("SELECT to_regclass('rollback_probe') AS table_name")).rows[0].table_name, null);
  assert.equal((await clients[0].query('SELECT * FROM schema_migrations')).rows.length, 3);
  await clients[1].query('SET lock_timeout = \'1s\'');
  await clients[1].query('SELECT pg_advisory_lock($1)', [20261031]);
  await clients[1].query('SELECT pg_advisory_unlock($1)', [20261031]);
});