const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const pg = require('pg');
const { NextRequest } = require('next/server');

function loadModule(file, overrides = {}, environment = {}) {
  const source = ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = vm.createContext({
    exports: {},
    process: { env: environment },
    console: { error() {} },
    require(name) {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      return require(name);
    },
  });
  const reload = () => vm.runInContext(`(function () { ${source}\n })()`, context);
  reload();
  return { exports: context.exports, reload };
}

function route(name, query) {
  const weight = loadModule('lib/weight.ts').exports;
  return loadModule(`app/api/${name}/route.ts`, {
    '@/lib/db': { query },
    '@/lib/weight': weight,
  }).exports;
}

function postRequest(body) {
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('pool is lazy, requires configuration, and reuses connections across reloads', async () => {
  let count = 0;
  const calls = [];
  class FakePool {
    constructor(configuration) {
      count++;
      assert.equal(configuration.connectionString, 'postgresql://test@localhost/test');
      assert.equal(configuration.connectionTimeoutMillis, 5000);
    }
    on(event, listener) {
      assert.equal(event, 'error');
      assert.equal(typeof listener, 'function');
    }
    async query(text, values) {
      calls.push({ text, values });
      return { rows: [{ value: 72.5 }] };
    }
  }
  const environment = {};
  const fixture = loadModule('lib/db.ts', {
    'server-only': {},
    pg: { ...pg, Pool: FakePool },
  }, environment);
  assert.equal(count, 0);
  await assert.rejects(fixture.exports.query('SELECT 1'), /DATABASE_URL must be set/);
  assert.equal(count, 0);
  environment.DATABASE_URL = 'postgresql://test@localhost/test';
  const values = ["notes with ' SQL characters"];
  assert.deepEqual(await fixture.exports.query('SELECT $1', values), [{ value: 72.5 }]);
  assert.equal(calls[0].values, values);
  assert.equal(calls[0].text, 'SELECT $1');
  await fixture.exports.query('SELECT 2');
  fixture.reload();
  await fixture.exports.query('SELECT 3');
  assert.equal(count, 1);
});

test('PostgreSQL measurements remain numbers and calendar dates remain strings', () => {
  loadModule('lib/db.ts', { 'server-only': {} });
  assert.equal(pg.types.getTypeParser(pg.types.builtins.NUMERIC)('72.50'), 72.5);
  assert.equal(pg.types.getTypeParser(pg.types.builtins.DATE)('2026-10-31'), '2026-10-31');
  const timestamp = pg.types.getTypeParser(pg.types.builtins.TIMESTAMPTZ)('2026-10-31 12:00:00+00');
  assert.equal(JSON.parse(JSON.stringify({ created_at: timestamp })).created_at, '2026-10-31T12:00:00.000Z');
});

const records = {
  biometrics: { date: '2026-10-31', metric_type: 'weight', value: 72.5, unit: 'kg' },
  activities: { date: '2026-10-31', activity_name: 'Run', activity_type: 'cardio', effort_level: 4, duration_minutes: 30 },
  stress: { date: '2026-10-31', stress_level: 3 },
};

for (const [name, record] of Object.entries(records)) {
  test(`${name} insert uses parameters and returns a saved-row array with status 201`, async () => {
    const notes = "private ' note";
    const saved = { id: 'test-id', ...record, notes };
    const handler = route(name, async (text, values) => {
      assert.match(text, new RegExp(`INSERT INTO ${name}`));
      assert.match(text, /RETURNING \*/);
      assert.equal(text.includes(notes), false);
      assert.equal(values.at(-1), notes);
      return [saved];
    });
    const response = await handler.POST(postRequest({ ...record, notes }));
    assert.equal(response.status, 201);
    assert.deepEqual((await response.json()).data, [saved]);
  });

  test(`${name} listing retains ordering and row limit`, async () => {
    const handler = route(name, async (text) => {
      assert.equal(text, `SELECT * FROM ${name} ORDER BY date DESC LIMIT 500`);
      return [record];
    });
    const response = await handler.GET();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: [record] });
  });

  test(`${name} rejects missing fields without querying`, async () => {
    const handler = route(name, async () => { throw new Error('Unexpected query'); });
    assert.equal((await handler.POST(postRequest({}))).status, 400);
  });
}

test('an absent profile returns data:null', async () => {
  const response = await route('profile', async () => []).GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: null });
});

test('profile save uses one atomic upsert and preserves its public response', async () => {
  const saved = { id: 'profile-id', height: 175, height_unit: 'cm', age: 35, notes: 'test' };
  let calls = 0;
  const handler = route('profile', async (text, values) => {
    calls++;
    assert.match(text, /INSERT INTO user_profile/);
    assert.match(text, /ON CONFLICT \(singleton\) DO UPDATE/);
    assert.match(text, /RETURNING id, created_at, updated_at, height, height_unit, age, notes/);
    assert.equal(values[0], saved.height);
    assert.equal(values.length, 4);
    return [saved];
  });
  const response = await handler.POST(postRequest(saved));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: 'Profile saved successfully', data: [saved] });
  assert.equal(calls, 1);
});

test('profile reads exclude the internal singleton column', async () => {
  const saved = { id: 'profile-id', height: 175 };
  const handler = route('profile', async (text) => {
    assert.match(text, /SELECT id, created_at, updated_at, height, height_unit, age, notes/);
    assert.match(text, /WHERE singleton = TRUE/);
    return [saved];
  });
  assert.deepEqual(await (await handler.GET()).json(), { data: saved });
});

test('CSV imports retain successful rows and count invalid/database-failed rows', async () => {
  let calls = 0;
  const handler = route('import', async (text, values) => {
    assert.match(text, /INSERT INTO stress/);
    assert.equal(typeof values[1], 'number');
    if (++calls === 2) throw new Error('private database details');
    return [];
  });
  const response = await handler.POST(postRequest({
    dataType: 'stress',
    csvData: 'date,stress_level,notes\n2026-10-31,3,ok\n2026-10-31,11,invalid\n2026-10-31,4,fails\n2026-10-31,5,ok',
  }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.imported, 2);
  assert.equal(result.skipped, 2);
  assert.equal(result.errors.length, 2);
  assert.equal(JSON.stringify(result).includes('private database details'), false);
});

test('weight API entries normalize pounds to kilograms before storage', async () => {
  let inserted;
  const handler = route('biometrics', async (_text, values) => {
    inserted = values;
    return [{ date: values[0], metric_type: values[1], value: values[2], unit: values[3] }];
  });
  const response = await handler.POST(postRequest({
    date: '2026-10-31', metric_type: 'weight', value: 160, unit: 'lbs',
  }));
  assert.equal(response.status, 201);
  assert.equal(inserted[2], 160 * 0.45359237);
  assert.equal(inserted[3], 'kg');
});

test('weight display conversion round-trips between kilograms and pounds', () => {
  const weight = loadModule('lib/weight.ts').exports;
  const kilograms = weight.poundsToKilograms(160);
  assert.ok(Math.abs(kilograms - 72.5747792) < 1e-10);
  assert.ok(Math.abs(weight.kilogramsToPounds(kilograms) - 160) < 1e-10);
});

test('weekly activity summaries group by Monday and weight effort by duration', () => {
  const { aggregateWeeklyActivities } = loadModule('lib/activitySummary.ts').exports;
  const summaries = aggregateWeeklyActivities([
    { date: '2026-10-25', activity_name: 'Walk', activity_type: 'cardio', effort_level: 6, duration_minutes: 60 },
    { date: '2026-10-25', activity_name: 'Run', activity_type: 'cardio', effort_level: 8, duration_minutes: 30 },
    { date: '2026-10-26', activity_name: 'Strength', activity_type: 'strength', effort_level: 5 },
  ]);

  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].weekStart, '2026-10-19');
  assert.equal(summaries[0].totalHours, 1.5);
  assert.equal(summaries[0].weightedEffort, 6.7);
  assert.equal(summaries[0].sessionCount, 2);
  assert.equal(summaries[0].sessionsWithoutDuration, 0);
  assert.equal(summaries[1].weekStart, '2026-10-26');
  assert.equal(summaries[1].totalHours, 0);
  assert.equal(summaries[1].weightedEffort, undefined);
  assert.equal(summaries[1].sessionCount, 1);
  assert.equal(summaries[1].sessionsWithoutDuration, 1);
});

test('weekly stress summaries count severity bands and retain weekly averages', () => {
  const { aggregateWeeklyStress } = loadModule('lib/stressSummary.ts').exports;
  const summaries = aggregateWeeklyStress([
    { date: '2026-10-25', stress_level: 2 },
    { date: '2026-10-25', stress_level: 3 },
    { date: '2026-10-25', stress_level: 4 },
    { date: '2026-10-25', stress_level: 7 },
    { date: '2026-10-25', stress_level: 8 },
    { date: '2026-10-25', stress_level: 10 },
    { date: '2026-10-26', stress_level: 7 },
  ]);

  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].weekStart, '2026-10-19');
  assert.equal(summaries[0].low, 2);
  assert.equal(summaries[0].moderate, 2);
  assert.equal(summaries[0].high, 2);
  assert.equal(summaries[0].readingCount, 6);
  assert.equal(summaries[0].averageStress, 5.7);
  assert.equal(summaries[1].weekStart, '2026-10-26');
  assert.equal(summaries[1].moderate, 1);
  assert.equal(summaries[1].readingCount, 1);
});

test('sleep entry saves sleep session details with parameterized values', async () => {
  const sleepEntry = {
    wake_date: '2026-10-31',
    bedtime: '23:00',
    wake_time: '07:00',
    sleep_duration_minutes: 450,
    restedness: 4,
    notes: 'Woke once',
  };
  let inserted;
  const handler = route('sleep', async (text, values) => {
    inserted = values;
    assert.match(text, /INSERT INTO sleep_entries/);
    assert.match(text, /RETURNING \*/);
    return [sleepEntry];
  });

  const response = await handler.POST(postRequest(sleepEntry));
  assert.equal(response.status, 201);
  assert.equal(inserted[0], sleepEntry.wake_date);
  assert.equal(inserted[1], sleepEntry.bedtime);
  assert.equal(inserted[2], sleepEntry.wake_time);
  assert.equal(inserted[3], sleepEntry.sleep_duration_minutes);
  assert.equal(inserted[4], sleepEntry.restedness);
  assert.equal(inserted[5], sleepEntry.notes);
  assert.deepEqual((await response.json()).data, [sleepEntry]);
});

test('sleep entry validates duration, times, and restedness before querying', async () => {
  const handler = route('sleep', async () => { throw new Error('Unexpected query'); });
  const validEntry = {
    wake_date: '2026-10-31', bedtime: '23:00', wake_time: '07:00',
    sleep_duration_minutes: 450,
  };

  assert.equal((await handler.POST(postRequest({ ...validEntry, sleep_duration_minutes: 0 }))).status, 400);
  assert.equal((await handler.POST(postRequest({ ...validEntry, bedtime: '25:00' }))).status, 400);
  assert.equal((await handler.POST(postRequest({ ...validEntry, restedness: 6 }))).status, 400);
});

test('sleep duration summaries aggregate by wake date and use age-appropriate target bands', () => {
  const { aggregateDailySleep, getSleepTargetBand } = loadModule('lib/sleepSummary.ts').exports;
  const summaries = aggregateDailySleep([
    { wake_date: '2026-10-31', bedtime: '23:00', wake_time: '07:00', sleep_duration_minutes: 420 },
    { wake_date: '2026-10-31', bedtime: '14:00', wake_time: '14:30', sleep_duration_minutes: 30 },
    { wake_date: '2026-11-01', bedtime: '22:30', wake_time: '06:30', sleep_duration_minutes: 480 },
  ]);

  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].wakeDate, '2026-10-31');
  assert.equal(summaries[0].sleepHours, 3.75);
  assert.equal(summaries[0].entryCount, 2);
  assert.equal(getSleepTargetBand(35).maximumHours, 9);
  assert.equal(getSleepTargetBand(70).maximumHours, 8);
  assert.equal(getSleepTargetBand(16), null);
  assert.equal(getSleepTargetBand(undefined).minimumHours, 7);
});

test('daily stress summaries average multiple readings without filling missing dates', () => {
  const { aggregateDailyStress } = loadModule('lib/stressSummary.ts').exports;
  const summaries = aggregateDailyStress([
    { date: '2026-10-25', stress_level: 2 },
    { date: '2026-10-25', stress_level: 6 },
    { date: '2026-10-27', stress_level: 9 },
  ]);

  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].date, '2026-10-25');
  assert.equal(summaries[0].readingCount, 2);
  assert.equal(summaries[0].averageStress, 4);
  assert.equal(summaries[1].date, '2026-10-27');
  assert.equal(summaries[1].averageStress, 9);
});

test('monthly stress summaries average recorded weeks and report coverage', () => {
  const { aggregateMonthlyStress } = loadModule('lib/stressSummary.ts').exports;
  const summaries = aggregateMonthlyStress([
    { weekStart: '2026-09-28', low: 2, moderate: 0, high: 0, readingCount: 2, averageStress: 2 },
    { weekStart: '2026-10-05', low: 0, moderate: 0, high: 3, readingCount: 3, averageStress: 8 },
    { weekStart: '2026-10-12', low: 0, moderate: 0, high: 0, readingCount: 0 },
    { weekStart: '2026-10-19', low: 0, moderate: 1, high: 0, readingCount: 1, averageStress: 4 },
  ]);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].monthStart, '2026-10-01');
  assert.equal(summaries[0].averageStress, 4.7);
  assert.equal(summaries[0].weeksWithReadings, 3);
  assert.equal(summaries[0].weeksInRange, 4);
  assert.equal(summaries[0].readingCount, 6);
});

test('biometric CSV imports normalize pounds to kilograms before storage', async () => {
  let inserted;
  const handler = route('import', async (_text, values) => {
    inserted = values;
    return [];
  });
  const response = await handler.POST(postRequest({
    dataType: 'biometric',
    csvData: 'date,metric_type,value,unit,notes\n2026-10-31,weight,160,lbs,',
  }));
  assert.equal(response.status, 200);
  assert.equal(inserted[2], 160 * 0.45359237);
  assert.equal(inserted[3], 'kg');
});

for (const [dataType, table] of [['biometric', 'biometrics'], ['activity', 'activities'], ['stress', 'stress']]) {
  test(`CSV export selects only the ${table} table and retains download headers`, async () => {
    const handler = route('export', async (text) => {
      assert.equal(text, `SELECT * FROM ${table} ORDER BY date ASC`);
      return [];
    });
    const response = await handler.GET(new NextRequest(`http://localhost/api/export?dataType=${dataType}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'text/csv');
    assert.match(response.headers.get('Content-Disposition'), /attachment; filename=/);
    assert.match(await response.text(), /^date,/);
  });
}

test('CSV export rejects a table injection attempt without querying', async () => {
  const handler = route('export', async () => { throw new Error('Unexpected query'); });
  const response = await handler.GET(new NextRequest('http://localhost/api/export?dataType=stress%3BDROP%20TABLE%20stress'));
  assert.equal(response.status, 400);
});

test('database failures return generic 500 responses, not database details', async () => {
  const handler = route('biometrics', async () => { throw new Error('private database details'); });
  const response = await handler.GET();
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Internal server error' });
});

test('real PostgreSQL preserves schema contracts and concurrent saves keep one profile', {
  skip: !process.env.TEST_DATABASE_URL,
}, async (context) => {
  const schema = `profile_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.connect();
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${schema}`,
  });
  context.after(async () => {
    try {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin.end();
    }
  });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const { applyMigrations } = await import('../scripts/migrate.mjs');
  const client = await pool.connect();
  try {
    await applyMigrations(client);
  } finally {
    client.release();
  }
  loadModule('lib/db.ts', { 'server-only': {} });
  const query = async (text, values) => (await pool.query(text, values)).rows;
  const profile = route('profile', query);
  assert.deepEqual(await (await profile.GET()).json(), { data: null });
  const responses = await Promise.all([170, 175, 180].map((height) =>
    profile.POST(postRequest({ height, height_unit: 'cm', age: 35 })),
  ));
  const saved = await Promise.all(responses.map((response) => response.json()));
  assert.equal(responses.every((response) => response.status === 200), true);
  assert.equal(new Set(saved.map((result) => result.data[0].id)).size, 1);
  const rows = await query('SELECT * FROM user_profile');
  assert.equal(rows.length, 1);
  assert.equal(typeof rows[0].height, 'number');
  const publicProfile = await (await profile.GET()).json();
  assert.equal(Object.hasOwn(publicProfile.data, 'singleton'), false);
  assert.equal(typeof publicProfile.data.created_at, 'string');
  await assert.rejects(pool.query('INSERT INTO user_profile (height) VALUES (160)'), { code: '23505' });
  await assert.rejects(pool.query('INSERT INTO user_profile (singleton) VALUES (FALSE)'), { code: '23514' });

  const biometrics = route('biometrics', query);
  const response = await biometrics.POST(postRequest(records.biometrics));
  assert.equal(response.status, 201);
  const entry = (await response.json()).data[0];
  assert.equal(entry.value, 72.5);
  assert.equal(entry.date, '2026-10-31');
  assert.equal(typeof entry.created_at, 'string');
});

test('production HTTP workflows preserve entry, profile, CSV, and validation contracts', {
  skip: !process.env.ACCEPTANCE_URL,
}, async () => {
  const base = process.env.ACCEPTANCE_URL;
  async function request(path, body, status = 200) {
    const response = await fetch(new URL(path, base), body === undefined ? {} : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, status, `${path} returned ${response.status}`);
    return response;
  }

  for (const name of ['biometrics', 'activities', 'stress']) {
    const result = await (await request(`/api/${name}`)).json();
    assert.deepEqual(result.data, [], 'ACCEPTANCE_URL must point to a disposable empty database');
  }
  assert.deepEqual(await (await request('/api/profile')).json(), { data: null });

  const measurements = [
    { ...records.biometrics, notes: 'acceptance-weight' },
    { date: '2026-10-31', metric_type: 'waistline', value: 85, unit: 'cm', notes: 'acceptance-waist' },
    { date: '2026-10-31', metric_type: 'body_fat_percentage', value: 20, unit: '%', notes: 'acceptance-body-fat' },
  ];
  for (const measurement of measurements) {
    const result = await (await request('/api/biometrics', measurement, 201)).json();
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].value, measurement.value);
    assert.equal(result.data[0].date, measurement.date);
    assert.equal(typeof result.data[0].id, 'string');
    assert.equal(typeof result.data[0].created_at, 'string');
  }
  for (const name of ['activities', 'stress']) {
    const result = await (await request(`/api/${name}`, { ...records[name], notes: 'acceptance-entry' }, 201)).json();
    assert.equal(result.data.length, 1);
  }

  const firstProfile = await (await request('/api/profile', { height: 170, height_unit: 'cm', age: 35 })).json();
  const updatedProfile = await (await request('/api/profile', { height: 175, height_unit: 'cm', age: 35 })).json();
  assert.equal(updatedProfile.data[0].id, firstProfile.data[0].id);
  const profile = (await (await request('/api/profile')).json()).data;
  assert.equal(profile.height, 175);
  assert.equal(Object.hasOwn(profile, 'singleton'), false);

  const csvRecords = [
    ['biometric', 'biometrics', 'date,metric_type,value,unit,notes\n2026-10-30,weight,73,kg,acceptance-import\n,weight,74,kg,invalid', 4],
    ['activity', 'activities', 'date,activity_name,activity_type,effort_level,duration_minutes,notes\n2026-10-30,Walk,cardio,2,20,acceptance-import\n2026-10-30,Walk,cardio,11,20,invalid', 2],
    ['stress', 'stress', 'date,stress_level,notes\n2026-10-30,2,acceptance-import\n2026-10-30,11,invalid', 2],
  ];
  for (const [dataType, table, csvData, count] of csvRecords) {
    const imported = await (await request('/api/import', { dataType, csvData })).json();
    assert.equal(imported.imported, 1);
    assert.equal(imported.skipped, 1);
    assert.equal(imported.errors.length, 1);
    const entries = (await (await request(`/api/${table}`)).json()).data;
    assert.equal(entries.length, count);
    const download = await request(`/api/export?dataType=${dataType}`);
    assert.equal(download.headers.get('Content-Type'), 'text/csv');
    assert.match(download.headers.get('Content-Disposition'), /attachment; filename=/);
    const csv = await download.text();
    assert.match(csv, /acceptance-import/);
    assert.equal(csv.trim().split('\n').length, count + 1);
    assert.match(csv.trim().split('\n')[1], /^2026-10-30,/);
  }

  await request('/api/biometrics', { ...records.biometrics, value: -1 }, 400);
  await request('/api/activities', { ...records.activities, effort_level: 11 }, 400);
  await request('/api/stress', { ...records.stress, stress_level: 11 }, 400);
  await request('/api/profile', { height: -1 }, 400);
  await request('/api/export?dataType=not-a-table', undefined, 400);
});