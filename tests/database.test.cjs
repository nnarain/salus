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
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
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
    '@/lib/bodyFat': loadModule('lib/bodyFat.ts').exports,
  }).exports;
}

function entryMutationRoute(name, query) {
  const mutation = loadModule('lib/entryMutation.ts', {
    '@/lib/db': { query },
    '@/lib/weight': loadModule('lib/weight.ts').exports,
  }).exports;
  return loadModule(`app/api/${name}/[id]/route.ts`, {
    '@/lib/entryMutation': mutation,
  }).exports;
}

function postRequest(body) {
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function patchRequest(body) {
  return new NextRequest('http://localhost/api/test', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('RFM estimates use sex-specific adult equations and equivalent measurement units', () => {
  const { estimateRelativeFatMass, getBodyFatEstimates } = loadModule('lib/bodyFat.ts').exports;
  const profile = { height: 180, height_unit: 'cm', age: 30, biological_sex: 'male' };
  const waist = { value: 90, unit: 'cm' };
  assert.equal(estimateRelativeFatMass(waist, profile), 24);
  assert.equal(estimateRelativeFatMass(waist, { ...profile, biological_sex: 'female' }), 36);
  assert.equal(estimateRelativeFatMass({ value: 90 / 2.54, unit: 'inches' }, profile), 24);
  assert.equal(estimateRelativeFatMass(waist, { ...profile, height: 180 / 2.54, height_unit: 'inches' }), 24);
  assert.equal(estimateRelativeFatMass(waist, { ...profile, height: 180 / 30.48, height_unit: 'feet' }), 24);
  for (const invalid of [null, {}, { ...profile, age: 19 }, { ...profile, age: undefined },
    { ...profile, biological_sex: undefined }, { ...profile, height_unit: undefined },
    { ...profile, height: 0 }, { ...profile, height: Infinity }]) {
    assert.equal(estimateRelativeFatMass(waist, invalid), undefined);
  }
  for (const invalid of [{ value: 0, unit: 'cm' }, { value: -1, unit: 'cm' },
    { value: NaN, unit: 'cm' }, { value: Infinity, unit: 'cm' }, { value: 90, unit: 'feet' },
    { value: 1, unit: 'cm' }]) {
    assert.equal(estimateRelativeFatMass(invalid, profile), undefined);
  }
  const entries = [{ date: '2026-10-31', metric_type: 'waistline', ...waist }, records.biometrics];
  const original = JSON.stringify(entries);
  assert.equal(JSON.stringify(getBodyFatEstimates(entries, profile)),
    JSON.stringify([{ date: '2026-10-31', percentage: 24, method: 'rfm' }]));
  assert.equal(JSON.stringify(entries), original);
  const duplicateDate = [
    { ...entries[0], value: 100, created_at: '2026-10-31T08:00:00Z' },
    { ...entries[0], value: 90, created_at: '2026-10-31T09:00:00Z' },
  ];
  assert.equal(JSON.stringify(getBodyFatEstimates(duplicateDate, profile)),
    JSON.stringify([{ date: '2026-10-31', percentage: 24, method: 'rfm' }]));
  assert.equal(JSON.stringify(getBodyFatEstimates(duplicateDate.map((entry) => ({
    ...entry, created_at: new Date(entry.created_at),
  })), profile)), JSON.stringify([{ date: '2026-10-31', percentage: 24, method: 'rfm' }]));
});

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
    assert.deepEqual(await response.json(), name === 'biometrics'
      ? { data: [record], bodyFatEstimates: [] }
      : { data: [record] });
  });

  test(`${name} rejects missing fields without querying`, async () => {
    const handler = route(name, async () => { throw new Error('Unexpected query'); });
    assert.equal((await handler.POST(postRequest({}))).status, 400);
  });
}

test('all tracked entry routes support validated edits and deletes by UUID', async () => {
  const id = '68b5c957-4ab8-4b55-945c-8bb4ff694705';
  const entries = {
    activities: { date: '2026-10-31', activity_name: 'Run', activity_type: 'cardio', effort_level: 5, duration_minutes: 30 },
    biometrics: { date: '2026-10-31', metric_type: 'weight', value: 80, unit: 'kg' },
    nutrition: { date: '2026-10-31', calories_kcal: 2000, protein_grams: 100, water_ml: null, estimated: false, partial: false },
    sleep: { wake_date: '2026-10-31', bedtime: '23:00', wake_time: '07:00', sleep_duration_minutes: 480, restedness: null },
    stress: { date: '2026-10-31', stress_level: 5 },
  };
  const tables = { activities: 'activities', biometrics: 'biometrics', nutrition: 'nutrition_entries', sleep: 'sleep_entries', stress: 'stress' };

  for (const [resource, entry] of Object.entries(entries)) {
    const table = tables[resource];
    const existing = { id, ...entry, notes: 'before' };
    const updated = { ...existing, notes: 'corrected' };
    let updateValues;
    const handler = entryMutationRoute(resource, async (text, values) => {
      if (text.startsWith('SELECT')) {
        assert.equal(text, `SELECT * FROM ${table} WHERE id = $1`);
        assert.equal(values[0], id);
        return [existing];
      }
      assert.match(text, new RegExp(`UPDATE ${table} SET notes = \\$1 WHERE id = \\$2 RETURNING \\*`));
      updateValues = values;
      return [updated];
    });
    const response = await handler.PATCH(patchRequest({ notes: 'corrected' }), { params: Promise.resolve({ id }) });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, updated);
    assert.deepEqual(Array.from(updateValues), ['corrected', id]);

    const deleteHandler = entryMutationRoute(resource, async (text, values) => {
      assert.equal(text, `DELETE FROM ${table} WHERE id = $1 RETURNING *`);
      assert.equal(values[0], id);
      return [existing];
    });
    const deleted = await deleteHandler.DELETE(new NextRequest('http://localhost/api/test', { method: 'DELETE' }), {
      params: Promise.resolve({ id }),
    });
    assert.equal(deleted.status, 200);
    assert.deepEqual((await deleted.json()).data, existing);
  }
});

test('entry edit rejects unknown fields and reports missing records', async () => {
  const id = '68b5c957-4ab8-4b55-945c-8bb4ff694705';
  const handler = entryMutationRoute('stress', async (text) => {
    assert.match(text, /SELECT \* FROM stress/);
    return [];
  });
  const unknownField = await handler.PATCH(patchRequest({ id }), { params: Promise.resolve({ id }) });
  assert.equal(unknownField.status, 400);
  const missing = await handler.PATCH(patchRequest({ notes: 'updated' }), { params: Promise.resolve({ id }) });
  assert.equal(missing.status, 404);
});

test('weight edits normalize supplied units and reject a unit-only reinterpretation', async () => {
  const id = '68b5c957-4ab8-4b55-945c-8bb4ff694705';
  const existing = { id, date: '2026-10-31', metric_type: 'weight', value: 80, unit: 'kg' };
  const calls = [];
  const handler = entryMutationRoute('biometrics', async (text, values) => {
    calls.push({ text, values });
    return text.startsWith('SELECT') ? [existing] : [{ ...existing, value: 160 * 0.45359237 }];
  });
  const unitOnly = await handler.PATCH(patchRequest({ unit: 'lbs' }), { params: Promise.resolve({ id }) });
  assert.equal(unitOnly.status, 400);
  assert.equal(calls.length, 1);

  const response = await handler.PATCH(patchRequest({ value: 160, unit: 'lbs' }), { params: Promise.resolve({ id }) });
  assert.equal(response.status, 200);
  assert.equal(calls[2].values[0], 160 * 0.45359237);
  assert.equal(calls[2].values[1], 'kg');
  assert.equal(calls[2].values[2], id);
});

test('biometrics API returns derived RFM separately without altering logged measurements', async () => {
  const data = [
    { date: '2026-10-31', metric_type: 'waistline', value: 90, unit: 'cm' },
    { date: '2026-10-30', metric_type: 'body_fat_percentage', value: 21, unit: '%' },
  ];
  for (const profile of [{ height: 180, height_unit: 'cm', age: 30, biological_sex: 'male' }, null]) {
    const queries = [];
    const handler = route('biometrics', async (text) => {
      queries.push(text);
      if (text.includes('FROM user_profile')) return profile ? [profile] : [];
      return data;
    });
    const response = await handler.GET();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data,
      bodyFatEstimates: profile ? [{ date: '2026-10-31', percentage: 24, method: 'rfm' }] : [],
    });
    assert.equal(queries.length, 2);
    assert.ok(queries.every((text) => text.startsWith('SELECT')));
  }
});

test('latest visceral fat range uses save order and excludes readings without bounds', async () => {
  const saved = { scale_min: 0, scale_max: 15 };
  const handler = route('biometrics', async (text) => {
    assert.match(text, /metric_type = 'visceral_fat_level'/);
    assert.match(text, /scale_min IS NOT NULL AND scale_max IS NOT NULL/);
    assert.match(text, /ORDER BY created_at DESC, id DESC LIMIT 1/);
    return [saved];
  });
  const response = await handler.GET(new NextRequest('http://localhost/api/biometrics?latestScaleRange=true'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [saved] });
});

test('latest visceral fat range is empty before a range has been saved', async () => {
  const handler = route('biometrics', async () => []);
  const response = await handler.GET(new NextRequest('http://localhost/api/biometrics?latestScaleRange=true'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [] });
});

test('an absent profile returns data:null', async () => {
  const response = await route('profile', async () => []).GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: null });
});

test('profile save uses one atomic upsert and preserves its public response', async () => {
  const saved = {
    id: 'profile-id', height: 175, height_unit: 'cm', age: 35, notes: 'test',
    biological_sex: 'female', activity_level: 'moderate', daily_calorie_target: 1900,
  };
  let calls = 0;
  const handler = route('profile', async (text, values) => {
    calls++;
    assert.match(text, /INSERT INTO user_profile/);
    assert.match(text, /ON CONFLICT \(singleton\) DO UPDATE/);
    assert.match(text, /RETURNING id, created_at, updated_at, height, height_unit, age, notes,/);
    assert.equal(values[0], saved.height);
    assert.equal(values[4], saved.biological_sex);
    assert.equal(values[5], saved.activity_level);
    assert.equal(values[6], saved.daily_calorie_target);
    assert.equal(values.length, 7);
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
    assert.match(text, /SELECT id, created_at, updated_at, height, height_unit, age, notes,/);
    assert.match(text, /biological_sex, activity_level, daily_calorie_target/);
    assert.match(text, /WHERE singleton = TRUE/);
    return [saved];
  });
  assert.deepEqual(await (await handler.GET()).json(), { data: saved });
});

test('profile rejects invalid calorie-estimate settings before querying', async () => {
  const handler = route('profile', async () => { throw new Error('Unexpected query'); });
  assert.equal((await handler.POST(postRequest({ biological_sex: 'other' }))).status, 400);
  assert.equal((await handler.POST(postRequest({ activity_level: 'extreme' }))).status, 400);
  assert.equal((await handler.POST(postRequest({ daily_calorie_target: 0 }))).status, 400);
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

test('visceral fat API entries allow zero and persist optional scale bounds', async () => {
  let inserted;
  const visceralEntry = {
    date: '2026-10-31', metric_type: 'visceral_fat_level', value: 0, unit: 'level',
    scale_min: 0, scale_max: 15, notes: 'Scale reading',
  };
  const handler = route('biometrics', async (_text, values) => {
    inserted = values;
    return [visceralEntry];
  });

  const response = await handler.POST(postRequest(visceralEntry));
  assert.equal(response.status, 201);
  assert.equal(inserted[2], 0);
  assert.equal(inserted[3], 'level');
  assert.equal(inserted[4], 0);
  assert.equal(inserted[5], 15);
  assert.equal(inserted[6], visceralEntry.notes);
});

test('visceral fat API rejects incomplete or incompatible scale ranges', async () => {
  const handler = route('biometrics', async () => { throw new Error('Unexpected query'); });
  const validEntry = {
    date: '2026-10-31', metric_type: 'visceral_fat_level', value: 8, unit: 'level',
  };

  assert.equal((await handler.POST(postRequest({ ...validEntry, scale_min: 0 }))).status, 400);
  assert.equal((await handler.POST(postRequest({ ...validEntry, scale_min: 0, scale_max: 7 }))).status, 400);
  assert.equal((await handler.POST(postRequest({ ...validEntry, unit: '%' }))).status, 400);
});

test('visceral fat CSV import preserves scale range metadata', async () => {
  let inserted;
  const handler = route('import', async (_text, values) => {
    inserted = values;
    return [];
  });
  const response = await handler.POST(postRequest({
    dataType: 'biometric',
    csvData: 'date,metric_type,value,unit,notes,scale_min,scale_max\n2026-10-31,visceral_fat_level,8,level,Scale reading,0,15',
  }));

  assert.equal(response.status, 200);
  assert.equal(inserted[4], 0);
  assert.equal(inserted[5], 15);
  assert.equal(inserted[6], 'Scale reading');
});

test('muscle mass API entries persist kilograms and notes without conversion', async () => {
  const entry = { date: '2026-10-31', metric_type: 'muscle_mass', value: 56.25, unit: 'kg', notes: 'Scale reading' };
  const handler = route('biometrics', async (text, values) => {
    assert.match(text, /INSERT INTO biometrics/);
    assert.equal(values[1], 'muscle_mass');
    assert.equal(values[2], 56.25);
    assert.equal(values[3], 'kg');
    assert.equal(values[4], null);
    assert.equal(values[5], null);
    assert.equal(values[6], entry.notes);
    return [entry];
  });
  const response = await handler.POST(postRequest(entry));
  assert.equal(response.status, 201);
  assert.deepEqual((await response.json()).data, [entry]);
});

test('muscle mass API rejects nonpositive values, non-kilogram units, and scale bounds', async () => {
  const handler = route('biometrics', async () => { throw new Error('Unexpected query'); });
  const entry = { date: '2026-10-31', metric_type: 'muscle_mass', value: 56.25, unit: 'kg' };
  for (const invalid of [{ value: 0 }, { value: -1 }, { value: null }, { unit: 'g' }, { unit: 'lbs' }, { scale_min: 0, scale_max: 100 }]) {
    assert.equal((await handler.POST(postRequest({ ...entry, ...invalid }))).status, 400);
  }
});

test('muscle mass CSV export and import preserve kilograms and notes', async () => {
  const entry = { date: '2026-10-31', metric_type: 'muscle_mass', value: 56.25, unit: 'kg', notes: 'Scale reading' };
  const exported = await route('export', async () => [entry]).GET(new NextRequest('http://localhost/api/export?dataType=biometric'));
  assert.equal(exported.status, 200);
  const csvData = await exported.text();
  assert.match(csvData, /2026-10-31,muscle_mass,56.25,kg,Scale reading,,/);
  let queries = 0;
  const handler = route('import', async (_text, values) => {
    queries++;
    assert.equal(values[1], 'muscle_mass');
    assert.equal(values[2], 56.25);
    assert.equal(values[3], 'kg');
    assert.equal(values[6], entry.notes);
    return [];
  });
  const response = await handler.POST(postRequest({ dataType: 'biometric', csvData }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).imported, 1);
  assert.equal(queries, 1);
});

test('muscle mass CSV import skips nonpositive values and non-kilogram units', async () => {
  let queries = 0;
  const handler = route('import', async () => { queries++; return []; });
  const response = await handler.POST(postRequest({
    dataType: 'biometric',
    csvData: 'date,metric_type,value,unit\n2026-10-31,muscle_mass,0,kg\n2026-10-31,muscle_mass,-1,kg\n2026-10-31,muscle_mass,56000,g\n2026-10-31,muscle_mass,120,lbs',
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.imported, 0);
  assert.equal(result.skipped, 4);
  assert.equal(queries, 0);
});

test('body composition plots actual percentages and a shared weight/muscle mass axis in either display unit', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const weight = loadModule('lib/weight.ts').exports;
  const healthRisk = loadModule('lib/healthRisk.ts').exports;
  const biometrics = [
    { date: '2026-10-28', metric_type: 'weight', value: 80, unit: 'kg' },
    { date: '2026-10-28', metric_type: 'muscle_mass', value: 56, unit: 'kg' },
    { date: '2026-10-28', metric_type: 'body_fat_percentage', value: 20, unit: '%' },
    { date: '2026-10-29', metric_type: 'muscle_mass', value: 56.3, unit: 'kg' },
    { date: '2026-10-30', metric_type: 'waistline', value: 85, unit: 'cm' },
    { date: '2026-10-31', metric_type: 'weight', value: weight.kilogramsToPounds(79), unit: 'lbs' },
    { date: '2026-10-31', metric_type: 'muscle_mass', value: 56.3, unit: 'kg' },
    { date: '2026-10-31', metric_type: 'body_fat_percentage', value: 19, unit: '%' },
  ];

  for (const [unit, withEstimate] of [['kg', false], ['kg', true], ['lbs', false], ['lbs', true]]) {
    const charts = [];
    let currentChart;
    const container = ({ children }) => children ?? null;
    const captureChart = ({ data, children }) => {
      currentChart = { data, axes: [], lines: [] };
      charts.push(currentChart);
      return children;
    };
    const recharts = {
      LineChart: captureChart, ComposedChart: captureChart,
      XAxis: container, CartesianGrid: container, Legend: container,
      ResponsiveContainer: container, ReferenceArea: container,
      YAxis: (props) => { currentChart.axes.push(props); return null; },
      Line: (props) => { currentChart.lines.push(props); return null; },
      Tooltip: ({ content }) => { currentChart.tooltip = content; return null; },
    };
    const Chart = loadModule('components/HealthMetricsChart.tsx', {
      recharts, '@/lib/weight': weight, '@/lib/healthRisk': healthRisk,
    }).exports.default;
    renderToStaticMarkup(React.createElement(Chart, {
      biometrics, profile: { height: 175, height_unit: 'cm' }, rangeYears: 'all', weightDisplayUnit: unit,
      bodyFatEstimates: withEstimate ? [{ date: '2026-10-30', percentage: 22.8, method: 'rfm' }] : [],
    }));
    const composition = charts.find((chart) => chart.lines.some((line) => line.dataKey === 'muscleMass'));
    assert.ok(composition);
    assert.deepEqual(composition.lines.map((line) => line.dataKey), withEstimate
      ? ['bodyFatPercentage', 'estimatedBodyFatPercentage', 'muscleMass', 'weight']
      : ['bodyFatPercentage', 'muscleMass', 'weight']);
    assert.equal(composition.lines[0].yAxisId, 'percentage');
    assert.equal(composition.lines.find((line) => line.dataKey === 'muscleMass').yAxisId, 'mass');
    assert.equal(composition.lines.find((line) => line.dataKey === 'weight').yAxisId, 'mass');
    assert.equal(composition.axes.find((axis) => axis.yAxisId === 'percentage').tickFormatter(15), '15%');
    assert.equal(composition.axes.find((axis) => axis.yAxisId === 'mass').orientation, 'right');
    const lastIndex = withEstimate ? 3 : 2;
    assert.equal(composition.data.length, withEstimate ? 4 : 3);
    assert.equal(composition.data[0].bodyFatPercentage, 20);
    assert.equal(composition.data[lastIndex].bodyFatPercentage, 19);
    const displayMass = (value) => unit === 'lbs' ? Number(weight.kilogramsToPounds(value).toFixed(1)) : value;
    assert.equal(composition.data[0].muscleMass, displayMass(56));
    assert.equal(composition.data[0].weight, displayMass(80));
    assert.equal(composition.data[lastIndex].weight, displayMass(79));
    assert.equal(composition.data[1].weight, undefined);
    assert.equal(composition.data[1].bodyFatPercentage, undefined);
    if (withEstimate) {
      const estimateLine = composition.lines.find((line) => line.dataKey === 'estimatedBodyFatPercentage');
      assert.equal(estimateLine.yAxisId, 'percentage');
      assert.equal(estimateLine.strokeDasharray, '6 4');
      assert.equal(estimateLine.name, 'Body Fat - Estimated (RFM)');
      assert.equal(composition.data[2].estimatedBodyFatPercentage, 22.8);
      assert.equal(composition.data[2].bodyFatPercentage, undefined);
      assert.equal(composition.data[2].normalizedBodyFat, undefined);
      assert.equal(composition.data[2].averagedNormalizedRisk, undefined);
      const waistRisk = healthRisk.calculateHealthRiskIndicator(undefined, composition.data[2].waistHeightRatio);
      assert.equal(composition.data[2].healthRisk, Number(waistRisk.toFixed(3)));
    }
    const tooltip = renderToStaticMarkup(React.cloneElement(composition.tooltip, {
      active: true,
      payload: [
        { dataKey: 'bodyFatPercentage', name: 'Body Fat %', value: 15.2, color: '#06b6d4', payload: composition.data[0] },
        { dataKey: 'estimatedBodyFatPercentage', name: 'Body Fat - Estimated (RFM)', value: 22.8, color: '#d97706', payload: composition.data[0] },
        { dataKey: 'muscleMass', name: 'Muscle Mass', value: displayMass(56), color: '#16a34a', payload: composition.data[0] },
        { dataKey: 'weight', name: 'Body Weight', value: displayMass(80), color: '#3b82f6', payload: composition.data[0] },
      ],
    }));
    assert.match(tooltip, /15\.2%/);
    assert.match(tooltip, /22\.8%/);
    assert.ok(tooltip.includes(`${displayMass(56).toFixed(1)} ${unit}`));
    assert.ok(tooltip.includes(`${displayMass(80).toFixed(1)} ${unit}`));
    assert.doesNotMatch(tooltip, /Athletic|Fitness|High Risk/);
  }
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

test('sleep entry defaults duration, accepts null restedness, and updates by wake date', async () => {
  let inserted;
  const handler = route('sleep', async (text, values) => {
    inserted = values;
    assert.match(text, /pg_advisory_xact_lock/);
    assert.match(text, /UPDATE sleep_entries/);
    assert.match(text, /WHERE NOT EXISTS \(SELECT 1 FROM updated\)/);
    return [{ wake_date: values[0], sleep_duration_minutes: values[3], restedness: values[4] }];
  });
  const response = await handler.POST(postRequest({
    wake_date: '2026-10-31', bedtime: '23:00', wake_time: '07:00', restedness: null,
  }));

  assert.equal(response.status, 201);
  assert.deepEqual(Array.from(inserted), ['2026-10-31', '23:00', '07:00', 480, null, null]);
  assert.deepEqual((await response.json()).data, [
    { wake_date: '2026-10-31', sleep_duration_minutes: 480, restedness: null },
  ]);
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

test('nutrition entries save independent quality-tagged rows and parameterize notes', async () => {
  const nutrition = {
    date: '2026-10-31',
    calories_kcal: 2150,
    protein_grams: 132.5,
    water_ml: 2400,
    estimated: true,
    partial: false,
    notes: 'Training day',
  };
  let inserted;
  const handler = route('nutrition', async (text, values) => {
    inserted = values;
    assert.match(text, /INSERT INTO nutrition_entries/);
    assert.doesNotMatch(text, /ON CONFLICT/);
    assert.match(text, /RETURNING \*/);
    return [nutrition];
  });

  const response = await handler.POST(postRequest(nutrition));
  assert.equal(response.status, 201);
  assert.equal(inserted[0], nutrition.date);
  assert.equal(inserted[1], nutrition.calories_kcal);
  assert.equal(inserted[2], nutrition.protein_grams);
  assert.equal(inserted[3], nutrition.water_ml);
  assert.equal(inserted[4], nutrition.estimated);
  assert.equal(inserted[5], nutrition.partial);
  assert.equal(inserted[6], nutrition.notes);
  assert.deepEqual((await response.json()).data, [nutrition]);
});

test('nutrition entries reject negative values and invalid dates before querying', async () => {
  const handler = route('nutrition', async () => { throw new Error('Unexpected query'); });
  const validEntry = {
    date: '2026-10-31', calories_kcal: 2000, protein_grams: 100, water_ml: 2000,
  };

  assert.equal((await handler.POST(postRequest({ ...validEntry, calories_kcal: -1 }))).status, 400);
  assert.equal((await handler.POST(postRequest({ ...validEntry, protein_grams: -0.1 }))).status, 400);
  assert.equal((await handler.POST(postRequest({ ...validEntry, water_ml: -1 }))).status, 400);
  assert.equal((await handler.POST(postRequest({ ...validEntry, date: '2026-02-30' }))).status, 400);
  assert.equal((await handler.POST(postRequest({ date: validEntry.date }))).status, 400);
});

test('nutrition entries allow water-only logging and store omitted values as null', async () => {
  let inserted;
  const handler = route('nutrition', async (_text, values) => {
    inserted = values;
    return [{ date: values[0], calories_kcal: values[1], protein_grams: values[2], water_ml: values[3] }];
  });
  const response = await handler.POST(postRequest({ date: '2026-10-31', water_ml: 600 }));

  assert.equal(response.status, 201);
  assert.deepEqual(Array.from(inserted), ['2026-10-31', null, null, 600, false, false, null]);
});

test('protein estimate uses the adult RDA baseline with an optional multiplier', () => {
  const { estimateProteinTargetGrams } = loadModule('lib/nutritionGoals.ts').exports;

  assert.equal(estimateProteinTargetGrams(70), 56);
  assert.equal(estimateProteinTargetGrams(82.4), 66);
  assert.equal(estimateProteinTargetGrams(70, 1.6), 112);
  assert.throws(() => estimateProteinTargetGrams(0), /Weight must be a positive finite number/);
  assert.throws(() => estimateProteinTargetGrams(70, 0), /Protein multiplier must be a positive finite number/);
});

test('maintenance estimate uses Mifflin-St Jeor and the selected activity multiplier', () => {
  const weight = loadModule('lib/weight.ts').exports;
  const { estimateMaintenanceFromFormula } = loadModule('lib/calorieEstimate.ts', {
    '@/lib/weight': weight,
    '@/lib/nutritionSummary': loadModule('lib/nutritionSummary.ts').exports,
  }).exports;
  const estimate = estimateMaintenanceFromFormula({
    age: 35,
    height: 175,
    height_unit: 'cm',
    biological_sex: 'male',
    activity_level: 'moderate',
  }, [
    { date: '2026-11-01', metric_type: 'weight', value: 80, unit: 'kg' },
  ]);

  assert.equal(estimate.caloriesKcal, 2672);
  assert.equal(estimate.source, 'formula');
  const olderWeightEstimate = estimateMaintenanceFromFormula({
    age: 35,
    height: 175,
    height_unit: 'cm',
    biological_sex: 'male',
    activity_level: 'moderate',
  }, [
    { date: '2026-09-01', metric_type: 'weight', value: 80, unit: 'kg' },
  ], new Date('2026-11-01T00:00:00Z'));
  assert.equal(olderWeightEstimate.source, 'formula');
  assert.equal(olderWeightEstimate.weightDate, '2026-09-01');
});

test('maintenance estimate calibrates after covered calorie and weight history exists', () => {
  const weight = loadModule('lib/weight.ts').exports;
  const { estimateMaintenanceFromHistory, getMaintenanceEstimate } = loadModule('lib/calorieEstimate.ts', {
    '@/lib/weight': weight,
    '@/lib/nutritionSummary': loadModule('lib/nutritionSummary.ts').exports,
  }).exports;
  const start = new Date('2026-10-18T00:00:00Z');
  const nutrition = Array.from({ length: 15 }, (_, dayOffset) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    return { date: date.toISOString().slice(0, 10), calories_kcal: 2200, protein_grams: 100, water_ml: 2000 };
  });
  const weights = [0, 3, 7, 10, 14].map((dayOffset) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    return {
      date: date.toISOString().slice(0, 10),
      metric_type: 'weight',
      value: 80 - dayOffset * 0.05,
      unit: 'kg',
    };
  });
  const calibrated = estimateMaintenanceFromHistory(nutrition, weights, new Date('2026-11-01T00:00:00Z'));

  assert.equal(calibrated.caloriesKcal, 2585);
  assert.equal(calibrated.source, 'logged_data');
  assert.equal(calibrated.daysCovered, 15);
  assert.equal(getMaintenanceEstimate({
    age: 35,
    height: 175,
    height_unit: 'cm',
    biological_sex: 'male',
    activity_level: 'moderate',
  }, nutrition, weights, new Date('2026-11-01T00:00:00Z')).source, 'logged_data');
  assert.equal(estimateMaintenanceFromHistory(nutrition.slice(0, 9), weights, new Date('2026-11-01T00:00:00Z')), null);
});

test('maintenance estimates aggregate meals and exclude estimated or partial days from coverage', () => {
  const weight = loadModule('lib/weight.ts').exports;
  const { estimateMaintenanceFromHistory } = loadModule('lib/calorieEstimate.ts', {
    '@/lib/weight': weight,
    '@/lib/nutritionSummary': loadModule('lib/nutritionSummary.ts').exports,
  }).exports;
  const start = new Date('2026-10-18T00:00:00Z');
  const nutrition = Array.from({ length: 15 }, (_, dayOffset) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    const day = date.toISOString().slice(0, 10);
    return [
      { date: day, calories_kcal: 1100 },
      { date: day, calories_kcal: 1100, estimated: dayOffset === 13, partial: dayOffset === 14 },
    ];
  }).flat();
  const weights = [0, 3, 7, 10, 14].map((dayOffset) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    return {
      date: date.toISOString().slice(0, 10),
      metric_type: 'weight', value: 80 - dayOffset * 0.05, unit: 'kg',
    };
  });
  const estimate = estimateMaintenanceFromHistory(nutrition, weights, new Date('2026-11-01T00:00:00Z'));

  assert.equal(estimate.caloriesKcal, 2585);
  assert.equal(estimate.nutritionDays, 13);
});

test('seven-day nutrition average uses only recorded days and reports coverage', () => {
  const { getSevenDayCalorieSummary } = loadModule('lib/dashboardMetrics.ts', {
    '@/lib/weight': loadModule('lib/weight.ts').exports,
    '@/lib/nutritionSummary': loadModule('lib/nutritionSummary.ts').exports,
  }).exports;
  const summary = getSevenDayCalorieSummary([
    { date: '2026-10-30', calories_kcal: 2000, protein_grams: 100, water_ml: 2000 },
    { date: '2026-10-31', calories_kcal: 2400, protein_grams: 100, water_ml: 2000 },
    { date: '2026-10-20', calories_kcal: 900, protein_grams: 50, water_ml: 1000 },
  ], new Date('2026-11-01T12:00:00Z'));

  assert.equal(summary.averageIntakeKcal, 2200);
  assert.equal(summary.daysLogged, 2);
  assert.equal(summary.windowDays, 7);
});

test('seven-day calorie coverage aggregates meals and excludes estimated or partial days', () => {
  const { getSevenDayCalorieSummary } = loadModule('lib/dashboardMetrics.ts', {
    '@/lib/weight': loadModule('lib/weight.ts').exports,
    '@/lib/nutritionSummary': loadModule('lib/nutritionSummary.ts').exports,
  }).exports;
  const summary = getSevenDayCalorieSummary([
    { date: '2026-10-31', calories_kcal: 1000 },
    { date: '2026-10-31', calories_kcal: 1200 },
    { date: '2026-11-01', calories_kcal: 1800, partial: true },
    { date: '2026-10-30', calories_kcal: 2100, estimated: true },
  ], new Date('2026-11-01T12:00:00Z'));

  assert.equal(summary.averageIntakeKcal, 2200);
  assert.equal(summary.daysLogged, 1);
});

test('30-day weight trend compares monthly averages and converts pounds to kilograms', () => {
  const { getThirtyDayWeightTrend, createSampleThirtyDayWeightTrend } = loadModule('lib/dashboardMetrics.ts', {
    '@/lib/weight': loadModule('lib/weight.ts').exports,
    '@/lib/nutritionSummary': loadModule('lib/nutritionSummary.ts').exports,
  }).exports;
  const weights = [
    { date: '2026-09-28', metric_type: 'weight', value: 180, unit: 'lbs' },
    { date: '2026-10-02', metric_type: 'weight', value: 178, unit: 'lbs' },
    { date: '2026-10-29', metric_type: 'weight', value: 80, unit: 'kg' },
    { date: '2026-10-31', metric_type: 'weight', value: 79.5, unit: 'kg' },
  ];
  const trend = getThirtyDayWeightTrend(weights, new Date('2026-11-01T12:00:00Z'));

  assert.equal(trend.currentAverageKg, 79.75);
  assert.equal(trend.previousDaysLogged, 2);
  assert.equal(trend.currentDaysLogged, 2);
  assert.ok(trend.differenceKg < 0);

  const sampleTrend = createSampleThirtyDayWeightTrend(new Date('2026-11-01T12:00:00Z'));
  assert.equal(sampleTrend.isSample, true);
  assert.equal(sampleTrend.currentDaysLogged, 5);
  assert.equal(sampleTrend.previousDaysLogged, 4);
});

test('summary colors distinguish calorie balance and contextualize weight direction', () => {
  const { getCalorieBalanceTone, getWeightTrendTone } = loadModule('lib/dashboardMetrics.ts', {
    '@/lib/weight': loadModule('lib/weight.ts').exports,
    '@/lib/nutritionSummary': loadModule('lib/nutritionSummary.ts').exports,
  }).exports;

  assert.equal(getCalorieBalanceTone(300), 'green');
  assert.equal(getCalorieBalanceTone(0), 'blue');
  assert.equal(getCalorieBalanceTone(-100), 'blue');
  assert.equal(getCalorieBalanceTone(100), 'blue');
  assert.equal(getCalorieBalanceTone(101), 'green');
  assert.equal(getCalorieBalanceTone(500), 'green');
  assert.equal(getCalorieBalanceTone(501), 'yellow');
  assert.equal(getCalorieBalanceTone(-101), 'yellow');
  assert.equal(getCalorieBalanceTone(-300), 'yellow');
  assert.equal(getCalorieBalanceTone(-301), 'red');
  assert.equal(getCalorieBalanceTone(-200), 'yellow');
  assert.equal(getCalorieBalanceTone(-400), 'red');
  assert.equal(getCalorieBalanceTone(700), 'yellow');
  assert.equal(getWeightTrendTone(0.3, 0.2), 'green');
  assert.equal(getWeightTrendTone(0.3, 0.8), 'red');
  assert.equal(getWeightTrendTone(-0.3, 0.8), 'green');
  assert.equal(getWeightTrendTone(-0.3, null), 'blue');
});

test('insight helpers pair prior-day stress with wake-date sleep and estimate dated calorie balance', () => {
  const weight = loadModule('lib/weight.ts').exports;
  const nutritionSummary = loadModule('lib/nutritionSummary.ts').exports;
  const calorieEstimate = loadModule('lib/calorieEstimate.ts', {
    '@/lib/weight': weight,
    '@/lib/nutritionSummary': nutritionSummary,
  }).exports;
  const sleepSummary = loadModule('lib/sleepSummary.ts').exports;
  const stressSummary = loadModule('lib/stressSummary.ts').exports;
  const insights = loadModule('lib/insights.ts', {
    '@/lib/weight': weight,
    '@/lib/calorieEstimate': calorieEstimate,
    '@/lib/sleepSummary': sleepSummary,
    '@/lib/stressSummary': stressSummary,
    '@/lib/nutritionSummary': nutritionSummary,
  }).exports;
  const pairs = insights.pairSleepWithPriorDayStress([
    { wake_date: '2026-10-31', bedtime: '23:00', wake_time: '07:00', sleep_duration_minutes: 420 },
  ], [
    { date: '2026-10-30', stress_level: 8 },
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].stressDate, '2026-10-30');
  assert.equal(pairs[0].wakeDate, '2026-10-31');
  assert.equal(pairs[0].sleepHours, 7);

  const balance = insights.buildDailyCalorieBalance([
    { date: '2026-10-31', calories_kcal: 1000 },
    { date: '2026-10-31', calories_kcal: 1000 },
    { date: '2026-11-01', calories_kcal: 2400, partial: true },
  ], [
    { date: '2026-10-01', metric_type: 'weight', value: 80, unit: 'kg' },
  ], {
    age: 35, height: 175, height_unit: 'cm', biological_sex: 'male', activity_level: 'moderate',
  }, new Date('2026-11-01T12:00:00Z'));
  assert.equal(balance.length, 1);
  assert.equal(balance[0].intakeKcal, 2000);
  assert.equal(balance[0].weightDate, '2026-10-01');
  assert.ok(balance[0].estimatedBalanceKcal > 0);
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
    profile.POST(postRequest({
      height, height_unit: 'cm', age: 35,
      biological_sex: 'female', activity_level: 'moderate', daily_calorie_target: 1900,
    })),
  ));
  const saved = await Promise.all(responses.map((response) => response.json()));
  assert.equal(responses.every((response) => response.status === 200), true);
  assert.equal(new Set(saved.map((result) => result.data[0].id)).size, 1);
  const rows = await query('SELECT * FROM user_profile');
  assert.equal(rows.length, 1);
  assert.equal(typeof rows[0].height, 'number');
  assert.equal(rows[0].biological_sex, 'female');
  assert.equal(rows[0].activity_level, 'moderate');
  assert.equal(rows[0].daily_calorie_target, 1900);
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