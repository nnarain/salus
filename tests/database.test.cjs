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

test('biometric API accepts omitted or null scale bounds from MCP for every metric', async () => {
  const entries = [
    { metric_type: 'weight', value: 72, unit: 'kg' },
    { metric_type: 'waistline', value: 90, unit: 'cm' },
    { metric_type: 'body_fat_percentage', value: 20, unit: '%' },
    { metric_type: 'muscle_mass', value: 56, unit: 'kg' },
    { metric_type: 'visceral_fat_level', value: 0, unit: 'level' },
  ];
  for (const entry of entries) {
    for (const bounds of [{}, { scale_min: null, scale_max: null }]) {
      const body = { date: '2026-10-31', ...entry, ...bounds };
      let queries = 0;
      const handler = route('biometrics', async (_text, values) => {
        queries++;
        assert.equal(values[4], null);
        assert.equal(values[5], null);
        return [body];
      });
      const response = await handler.POST(postRequest(body));
      assert.equal(response.status, 201, JSON.stringify(body));
      assert.equal(queries, 1);
      assert.deepEqual((await response.json()).data, [body]);
    }
  }
});

test('biometric API rejects actual scale bounds for non-visceral metrics', async () => {
  const handler = route('biometrics', async () => { throw new Error('Unexpected query'); });
  for (const entry of [
    { metric_type: 'weight', unit: 'kg' },
    { metric_type: 'waistline', unit: 'cm' },
    { metric_type: 'body_fat_percentage', unit: '%' },
    { metric_type: 'muscle_mass', unit: 'kg' },
  ]) {
    const response = await handler.POST(postRequest({
      date: '2026-10-31', value: 50, ...entry, scale_min: 0, scale_max: 100,
    }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /only supported for visceral fat/);
  }
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
  assert.equal((await handler.POST(postRequest({ ...validEntry, scale_min: 0, scale_max: null }))).status, 400);
  assert.equal((await handler.POST(postRequest({ ...validEntry, scale_min: null, scale_max: 15 }))).status, 400);
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

test('health risk equally averages available body fat, waist, and scaled visceral fat', () => {
  const { calculateHealthRiskIndicator } = loadModule('lib/healthRisk.ts').exports;
  assert.ok(Math.abs(calculateHealthRiskIndicator(25, 0.515, 0.8) - 0.6) < 1e-10);
  assert.ok(Math.abs(calculateHealthRiskIndicator(25, undefined, 0.8) - 0.65) < 1e-10);
  assert.equal(calculateHealthRiskIndicator(undefined, undefined, 0), 0);
  assert.equal(calculateHealthRiskIndicator(undefined, undefined, 2), 1);
  assert.equal(calculateHealthRiskIndicator(undefined, undefined, -1), 0);
  assert.equal(calculateHealthRiskIndicator(), null);
  for (const unavailable of [undefined, null, NaN, Infinity]) {
    assert.equal(calculateHealthRiskIndicator(25, 0.515, unavailable),
      calculateHealthRiskIndicator(25, 0.515));
    assert.equal(calculateHealthRiskIndicator(undefined, undefined, unavailable), null);
  }
});

test('risk history and hero use latest independently scaled visceral fat with comparable trends', () => {
  const healthRisk = loadModule('lib/healthRisk.ts').exports;
  const { getRiskHistory, getRiskJourney } = loadModule('lib/riskJourney.ts', {
    '@/lib/healthRisk': healthRisk,
  }).exports;
  const today = new Date('2026-11-26T12:00:00Z');
  const profile = { height: 200, height_unit: 'cm' };
  const visceral = (date, scale_max) => ({
    date, metric_type: 'visceral_fat_level', value: 8, unit: 'level', scale_min: 0, scale_max,
  });
  const entries = [
    visceral('2026-11-25', 10),
    { date: '2026-11-14', metric_type: 'body_fat_percentage', value: 25, unit: '%' },
    { date: '2026-11-14', metric_type: 'waistline', value: 103, unit: 'cm' },
    visceral('2026-11-15', 40),
  ];
  const original = JSON.stringify(entries);
  const history = getRiskHistory(entries, profile, today);
  const journey = getRiskJourney(entries, profile, today);
  assert.ok(Math.abs(journey.score - 0.6) < 1e-10);
  assert.equal(journey.score, history.at(-1).score);
  assert.equal(journey.visceralFat.value, 0.8);
  assert.equal(journey.visceralFat.level, 8);
  assert.equal(journey.currentDate, '2026-11-25');
  assert.equal(journey.trend.days, 10);
  assert.ok(Math.abs(journey.trend.change - 0.2) < 1e-10);
  assert.ok(Math.abs(journey.visceralFatTrend.change - 0.6) < 1e-10);
  assert.equal(journey.visceralFatTrend.days, 10);
  assert.equal(journey.milestoneDays, null);
  assert.equal(JSON.stringify(entries), original);

  const missing = getRiskJourney([...entries, visceral('2026-11-26', undefined)], profile, today);
  assert.equal(missing.visceralFat, undefined);
  assert.ok(Math.abs(missing.score - 0.5) < 1e-10);
  assert.equal(missing.trend, null);
  const addedFactor = getRiskJourney(entries.filter(entry => entry.date !== '2026-11-15'), profile, today);
  assert.equal(addedFactor.trend, null);
  const stale = getRiskJourney([
    visceral('2026-09-01', 10),
    { ...entries[1], date: '2026-11-15', value: 30 },
    { ...entries[1], date: '2026-11-25', value: 25 },
  ], profile, today);
  assert.equal(stale.trend, null);
  assert.equal(stale.milestoneDays, null);
  const zero = getRiskJourney([{ ...visceral('2026-11-25', 10), value: 0 }], null, today);
  assert.equal(zero.score, 0);
  assert.equal(zero.visceralFat.value, 0);
  assert.equal(getRiskJourney([visceral('2026-11-25', undefined)], null, today), null);
});

test('normalized health graph includes visceral fat and the same historical composite as the hero', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const healthRisk = loadModule('lib/healthRisk.ts').exports;
  const journey = loadModule('lib/riskJourney.ts', { '@/lib/healthRisk': healthRisk }).exports;
  const charts = [];
  let riskView = 'trends';
  let current;
  const container = ({ children }) => children ?? null;
  const capture = ({ data, children }) => { current = { data, lines: [], areas: [], zones: [] }; charts.push(current); return children; };
  const Chart = loadModule('components/HealthMetricsChart.tsx', {
    react: {
      ...React,
      useState(initial) {
        const state = React.useState(initial);
        return initial === 'trends' ? [riskView, state[1]] : state;
      },
    },
    '@/lib/weight': loadModule('lib/weight.ts').exports,
    '@/lib/healthRisk': healthRisk,
    '@/lib/riskJourney': journey,
    '@/lib/bodyFat': loadModule('lib/bodyFat.ts').exports,
    '@/lib/chartRange': loadModule('lib/chartRange.ts').exports,
    recharts: {
      LineChart: capture, ComposedChart: capture, ResponsiveContainer: container,
      XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
      Legend: () => null,
      ReferenceArea: (props) => { current.zones.push(props); return null; },
      Area: (props) => { current.areas.push(props); return null; },
      Line: (props) => { current.lines.push(props); return null; },
      Tooltip: ({ content }) => { current.tooltip = content; return null; },
    },
  }).exports.default;
  const profile = { height: 200, height_unit: 'cm' };
  const biometrics = [
    { date: '2026-11-24', metric_type: 'body_fat_percentage', value: 25, unit: '%' },
    { date: '2026-11-24', metric_type: 'waistline', value: 103, unit: 'cm' },
    { date: '2026-11-25', metric_type: 'visceral_fat_level', value: 8, unit: 'level', scale_min: 0, scale_max: 10, created_at: '2026-11-25T09:00:00Z' },
    { date: '2026-11-25', metric_type: 'visceral_fat_level', value: 8, unit: 'level', scale_min: 0, scale_max: 40, created_at: '2026-11-25T08:00:00Z' },
  ];
  const render = (entries) => renderToStaticMarkup(React.createElement(Chart, {
    biometrics: entries, profile, rangeYears: 'all', weightDisplayUnit: 'kg',
  }));
  const html = render(biometrics);
  const normalized = charts[0];
  assert.equal(normalized.areas.length, 0);
  assert.match(html, /Normalized Visceral Fat/);
  assert.match(html, /Main progression indicator/);
  assert.match(html, /Contributing factors.*equal weight when available/);
  const visceralLine = normalized.lines.find(line => line.dataKey === 'normalizedVisceralFat');
  assert.ok(visceralLine);
  assert.equal(visceralLine.connectNulls, false);
  const primaryLine = normalized.lines.at(-1);
  assert.equal(primaryLine.dataKey, 'averagedNormalizedRisk');
  assert.ok(normalized.lines.slice(0, -1).every(line => line.strokeWidth < primaryLine.strokeWidth
    && line.strokeOpacity < 1 && line.strokeDasharray));
  assert.equal(normalized.data[1].normalizedVisceralFat, 0.8);
  assert.equal(normalized.data[1].averagedNormalizedRisk, 0.6);
  assert.equal(normalized.data[1].healthRisk, 0.6);
  assert.equal(normalized.data[1].averagedNormalizedRisk,
    Number(journey.getRiskJourney(biometrics, profile).score.toFixed(3)));
  const Hero = loadModule('components/ZoneMilestoneCard.tsx', {
    '@/lib/riskJourney': journey,
    '@/components/Modal': { default: () => null },
  }).exports.default;
  const hero = renderToStaticMarkup(React.createElement(Hero, {
    biometrics, profile, loading: false, error: null,
  }));
  assert.match(hero, /0\.60/);
  assert.match(hero, /Based on waist-to-height, body fat, visceral fat/);
  const tooltip = renderToStaticMarkup(React.cloneElement(normalized.tooltip, {
    active: true,
    payload: [{ dataKey: 'normalizedVisceralFat', name: 'Normalized Visceral Fat', value: 0.8, color: '#f97316', payload: normalized.data[1] }],
  }));
  assert.match(tooltip, /0\.800/);
  assert.match(tooltip, /device-scale position/i);
  assert.match(tooltip, /Health risk indicator/);
  assert.match(tooltip, /0\.600/);
  assert.match(tooltip, /divided by 3/);
  assert.match(tooltip, /0\.267/);
  assert.match(tooltip, /Reading: 2026-11-24/);
  assert.match(tooltip, /Factor contributions to the overall 0-1 score/);
  assert.equal(normalized.data[1].riskFactors.length, 3);
  const contributionSum = normalized.data[1].riskFactors
    .reduce((sum, factor, _, factors) => sum + factor.score / factors.length, 0);
  assert.ok(Math.abs(contributionSum - normalized.data[1].averagedNormalizedRisk) < 1e-10);
  render([...biometrics, { ...biometrics[2], date: '2026-11-26', scale_max: undefined }]);
  const missing = charts[2].data[2];
  assert.equal(missing.normalizedVisceralFat, undefined);
  assert.equal(missing.averagedNormalizedRisk, 0.5);
  assert.equal(missing.riskFactors.length, 2);
  const missingTooltip = renderToStaticMarkup(React.cloneElement(charts[2].tooltip, {
    active: true,
    payload: [{ dataKey: 'averagedNormalizedRisk', name: 'Health risk indicator', value: 0.5, color: '#7c3aed', payload: missing }],
  }));
  assert.match(missingTooltip, /divided by 2/);
  assert.match(missingTooltip, /0\.250/);
  assert.doesNotMatch(missingTooltip, /Visceral fat/);
  render([{ ...biometrics[2], value: 0 }]);
  const zero = charts[4].data[0];
  const zeroTooltip = renderToStaticMarkup(React.cloneElement(charts[4].tooltip, {
    active: true,
    payload: [{ dataKey: 'averagedNormalizedRisk', name: 'Health risk indicator', value: 0, color: '#7c3aed', payload: zero }],
  }));
  assert.match(zeroTooltip, /divided by 1/);
  assert.match(zeroTooltip, /0\.000/);
  assert.equal(zero.riskFactors[0].score, 0);

  riskView = 'contributions';
  const stackedEntries = [
    ...biometrics.map(entry => entry.metric_type === 'body_fat_percentage' ? { ...entry, value: 23.41 } : entry),
    { ...biometrics[2], date: '2026-11-26', scale_max: undefined },
    { date: '2026-11-27', metric_type: 'weight', value: 80, unit: 'kg' },
  ];
  const stackedHtml = render(stackedEntries);
  const stacked = charts.at(-2);
  assert.match(stackedHtml, /combined top edge is the purple overall indicator/);
  assert.equal(stacked.areas.length, 3);
  assert.ok(stacked.areas.every(area => area.stackId === 'risk-contributions'
    && area.type === 'linear' && area.connectNulls === false && area.fillOpacity < 0.5));
  assert.equal(stacked.lines.length, 1);
  assert.equal(stacked.lines[0].dataKey, 'contributionTotal');
  assert.equal(stacked.lines[0].type, 'linear');
  assert.equal(stacked.zones.length, normalized.zones.length);
  for (const point of stacked.data.filter(point => point.riskFactors)) {
    const total = stacked.areas.reduce((sum, area) => sum + point[area.dataKey], 0);
    assert.ok(Math.abs(total - point.contributionTotal) < 1e-12);
    for (const factor of point.riskFactors) {
      assert.equal(point[factor.contributionKey], factor.score / point.riskFactors.length);
    }
  }
  assert.equal(stacked.data[2].visceralFatContribution, 0);
  assert.equal(stacked.data[2].riskFactors.length, 2);
  assert.equal(stacked.data[3].contributionTotal, undefined);
  assert.ok(stacked.areas.every(area => stacked.data[3][area.dataKey] === undefined));
  render([{ ...biometrics[2], value: 0 }]);
  const zeroStack = charts.at(-2);
  assert.equal(zeroStack.areas.length, 1);
  assert.equal(zeroStack.areas[0].dataKey, 'visceralFatContribution');
  assert.equal(zeroStack.data[0].contributionTotal, 0);
  assert.equal(zeroStack.data[0].visceralFatContribution, 0);
  riskView = 'trends';
  render(biometrics);
  assert.equal(charts.at(-2).areas.length, 0);
  assert.equal(charts.at(-2).lines.at(-1).dataKey, 'averagedNormalizedRisk');
});

test('risk journey projects comparable readings across three waypoints per zone', () => {
  const { getRiskJourney, RISK_MILESTONES } = loadModule('lib/riskJourney.ts', {
    '@/lib/healthRisk': loadModule('lib/healthRisk.ts').exports,
  }).exports;
  assert.equal(RISK_MILESTONES.length, 9);
  assert.deepEqual(Array.from(RISK_MILESTONES).filter((value) => value >= 0.67).length, 3);
  assert.deepEqual(Array.from(RISK_MILESTONES).filter((value) => value < 0.67 && value >= 0.33).length, 3);
  assert.deepEqual(Array.from(RISK_MILESTONES).filter((value) => value < 0.33).length, 3);
  const today = new Date('2026-11-25T12:00:00Z');
  const entries = [
    { date: '2026-11-15', metric_type: 'waistline', value: 44, unit: 'inches' },
    { date: '2026-11-15', metric_type: 'body_fat_percentage', value: 30, unit: '%' },
    { date: '2026-11-25', metric_type: 'waistline', value: 42, unit: 'inches' },
    { date: '2026-11-25', metric_type: 'body_fat_percentage', value: 28, unit: '%' },
  ];
  const journey = getRiskJourney(entries, { height: 70, height_unit: 'inches' }, today);
  assert.equal(journey.zone, 'High Risk');
  assert.ok(Math.abs(journey.waist.value - 0.6) < 1e-10);
  assert.equal(journey.trend.days, 10);
  assert.ok(journey.trend.change < 0);
  assert.ok(Math.abs(journey.waistTrend.change - (-5.08)) < 1e-10);
  assert.equal(journey.waistTrend.days, 10);
  assert.equal(journey.bodyFatTrend.change, -2);
  assert.equal(journey.bodyFatTrend.days, 10);
  assert.equal(journey.nextMilestone, 0.78);
  assert.ok(journey.milestoneDays > 0);
  assert.ok(journey.nextZoneDays > journey.milestoneDays);
  assert.ok(journey.lowRiskDays > journey.nextZoneDays);
  assert.equal(getRiskJourney([], null, today), null);
});

test('risk journey reports individual recent measurement changes without treating carried readings as new', () => {
  const { getRiskJourney } = loadModule('lib/riskJourney.ts', {
    '@/lib/healthRisk': loadModule('lib/healthRisk.ts').exports,
  }).exports;
  const today = new Date('2026-11-25T12:00:00Z');
  const profile = { height: 175, height_unit: 'cm' };
  const entries = [
    { date: '2026-11-01', metric_type: 'waistline', value: 110, unit: 'cm' },
    { date: '2026-11-14', metric_type: 'waistline', value: 40, unit: 'inches' },
    { date: '2026-11-15', metric_type: 'body_fat_percentage', value: 30, unit: '%' },
    { date: '2026-11-20', metric_type: 'body_fat_percentage', value: 29, unit: '%' },
    { date: '2026-11-24', metric_type: 'waistline', value: 100, unit: 'cm' },
  ];
  const journey = getRiskJourney(entries, profile, today);
  assert.ok(Math.abs(journey.waistTrend.change - (-1.6)) < 1e-10);
  assert.equal(journey.waistTrend.days, 10);
  assert.equal(journey.bodyFatTrend.change, -1);
  assert.equal(journey.bodyFatTrend.days, 5);
  const oneWaist = getRiskJourney(entries.filter((entry) => entry.date !== '2026-11-14'), profile, today);
  assert.equal(oneWaist.waistTrend, null);
  assert.equal(oneWaist.bodyFatTrend.change, -1);
  assert.equal(getRiskJourney(entries, profile, new Date('2027-01-01T12:00:00Z')).bodyFatTrend, null);
});

test('risk journey explains elapsed time, comparison windows, stale factors, and unavailable estimates', () => {
  const module = loadModule('lib/riskJourney.ts', {
    '@/lib/healthRisk': loadModule('lib/healthRisk.ts').exports,
  }).exports;
  const { getRiskJourney } = module;
  const today = new Date('2026-11-28T12:00:00Z');
  const fat = (date, value) => ({ date, metric_type: 'body_fat_percentage', value, unit: '%' });
  const consecutive = [fat('2026-11-25', 30), fat('2026-11-26', 29), fat('2026-11-27', 28)];
  const short = getRiskJourney(consecutive, null, today);
  assert.equal(short.trend, null);
  assert.equal(short.trendCoverage.dateCount, 3);
  assert.equal(short.trendCoverage.spanDays, 2);
  assert.match(short.trendUnavailableReason, /need 1 more day of separation/);
  assert.match(short.trendUnavailableReason, /on or after 2026-11-28/);
  assert.match(short.bodyFatTrendUnavailableReason, /need 1 more day/);
  const endpoints = getRiskJourney([consecutive[0], fat('2026-11-28', 27)], null, today);
  assert.equal(endpoints.trendCoverage.dateCount, 2);
  assert.equal(endpoints.trend.days, 3);
  assert.equal(endpoints.trendUnavailableReason, null);
  assert.equal(endpoints.estimateUnavailableReason, null);
  assert.ok(endpoints.milestoneDays > 0);
  assert.ok(endpoints.lowRiskDays > 0);
  const onlyOne = getRiskJourney([fat('2026-11-25', 30)], null, today);
  assert.match(onlyOne.trendUnavailableReason, /Only 1 of the required 2/);
  const outside = getRiskJourney([fat('2026-11-13', 30), fat('2026-11-28', 28)], null, today);
  assert.equal(outside.trendCoverage.dateCount, 1);
  assert.match(outside.trendUnavailableReason, /Only 1 of the required 2/);
  const boundary = getRiskJourney([fat('2026-11-14', 30), fat('2026-11-28', 28)], null, today);
  assert.equal(boundary.trend.days, 14);
  const noRecent = getRiskJourney([fat('2026-11-10', 28)], null, today);
  assert.match(noRecent.trendUnavailableReason, /No comparable indicator dates in the past 14 days/);
  const profile = { height: 175, height_unit: 'cm' };
  const waist = (date) => ({ date, metric_type: 'waistline', value: 100, unit: 'cm' });
  const stale = getRiskJourney([waist('2026-10-28'), consecutive[0], fat('2026-11-28', 27)], profile, today);
  assert.equal(stale.trend, null);
  assert.match(stale.trendUnavailableReason, /Refresh waist-to-height.*31 days old/);
  const freshBoundary = getRiskJourney([waist('2026-10-29'), consecutive[0], fat('2026-11-28', 27)], profile, today);
  assert.ok(freshBoundary.trend);
  const changedFactors = getRiskJourney([...consecutive, waist('2026-11-28')], profile, today);
  assert.equal(changedFactors.trendCoverage.dateCount, 1);
  assert.match(changedFactors.trendUnavailableReason, /same available factors/);
  for (const value of [30, 31]) {
    const notImproving = getRiskJourney([consecutive[0], fat('2026-11-28', value)], null, today);
    assert.ok(notImproving.trend);
    assert.equal(notImproving.trendUnavailableReason, null);
    assert.equal(notImproving.milestoneDays, null);
    assert.match(notImproving.estimateUnavailableReason, /stable or increasing/);
  }
  const passed = getRiskJourney([fat('2026-11-18', 31), fat('2026-11-23', 28)], null, today);
  assert.ok(passed.trend);
  assert.equal(passed.estimateUnavailableReason, null);
  assert.equal(passed.milestoneDays, null);

  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Hero = loadModule('components/ZoneMilestoneCard.tsx', {
    '@/lib/riskJourney': { ...module, getRiskJourney: (entries, profile) => getRiskJourney(entries, profile, today) },
    '@/components/Modal': { default: () => null },
  }).exports.default;
  const render = (biometrics) => renderToStaticMarkup(React.createElement(Hero, {
    biometrics, profile: null, loading: false, error: null,
  }));
  assert.match(render(consecutive), /What is missing for a trend/);
  assert.match(render(consecutive), /need 1 more day of separation/);
  assert.match(render([consecutive[0], fat('2026-11-28', 31)]), /Why date estimates are unavailable/);
  assert.match(render([fat('2026-11-18', 31), fat('2026-11-23', 28)]), /projected date is today or earlier/);
  const ready = render([consecutive[0], fat('2026-11-28', 27)]);
  assert.doesNotMatch(ready, /What is missing for a trend|Why date estimates are unavailable|Recent trend coverage|comparable indicator dates/);
  assert.match(ready, /~\d/);
  const reached = render([fat('2026-11-28', 18)]);
  assert.doesNotMatch(reached, /What is missing for a trend|comparable indicator dates/);
  assert.match(reached, /All waypoints reached/);
});

test('risk journey does not project stale, incomparable, stable or worsening data', () => {
  const { getRiskJourney } = loadModule('lib/riskJourney.ts', {
    '@/lib/healthRisk': loadModule('lib/healthRisk.ts').exports,
  }).exports;
  const today = new Date('2026-11-25T12:00:00Z');
  const fat = (date, value) => ({ date, metric_type: 'body_fat_percentage', value, unit: '%' });
  const waist = (date, value) => ({ date, metric_type: 'waistline', value, unit: 'cm' });
  const profile = { height: 175, height_unit: 'cm' };
  assert.equal(getRiskJourney([fat('2026-11-01', 30), fat('2026-11-10', 28)], profile, today).trend, null);
  assert.equal(getRiskJourney([fat('2026-11-15', 30), fat('2026-11-25', 28), waist('2026-11-25', 100)], profile, today).trend, null);
  assert.equal(getRiskJourney([waist('2026-09-01', 100), fat('2026-11-15', 30), fat('2026-11-25', 28)], profile, today).trend, null);
  const pastEstimate = getRiskJourney([fat('2026-11-15', 31), fat('2026-11-20', 28)], profile, today);
  assert.ok(pastEstimate.trend.change < 0);
  assert.equal(pastEstimate.milestoneDays, null);
  for (const end of [30, 31]) {
    const journey = getRiskJourney([fat('2026-11-15', 30), fat('2026-11-25', end)], profile, today);
    assert.equal(journey.milestoneDays, null);
    assert.equal(journey.nextZoneDays, null);
  }
  const low = getRiskJourney([fat('2026-11-25', 18)], profile, today);
  assert.equal(low.zone, 'Low Risk');
  assert.equal(low.nextMilestone, null);
  assert.equal(low.nextZone, null);
});

test('body composition averages available body fat sources without inventing missing values', () => {
  const { averageBodyFatPercentage } = loadModule('lib/bodyFat.ts').exports;
  assert.equal(averageBodyFatPercentage(20, 24), 22);
  assert.equal(averageBodyFatPercentage(20), 20);
  assert.equal(averageBodyFatPercentage(undefined, 24), 24);
  assert.equal(averageBodyFatPercentage(), undefined);
  assert.equal(averageBodyFatPercentage(NaN, 24), 24);
  assert.equal(averageBodyFatPercentage(0, 100), undefined);
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
      currentChart = { data, axes: [], lines: [], zones: [] };
      charts.push(currentChart);
      return children;
    };
    const recharts = {
      LineChart: captureChart, ComposedChart: captureChart,
      XAxis: container, CartesianGrid: container, Legend: container,
      ResponsiveContainer: container,
      ReferenceArea: (props) => { currentChart.zones.push(props); return null; },
      YAxis: (props) => { currentChart.axes.push(props); return null; },
      Line: (props) => { currentChart.lines.push(props); return null; },
      Tooltip: ({ content }) => { currentChart.tooltip = content; return null; },
    };
    const Chart = loadModule('components/HealthMetricsChart.tsx', {
      recharts, '@/lib/weight': weight, '@/lib/healthRisk': healthRisk,
      '@/lib/riskJourney': loadModule('lib/riskJourney.ts', { '@/lib/healthRisk': healthRisk }).exports,
      '@/lib/bodyFat': loadModule('lib/bodyFat.ts').exports,
      '@/lib/chartRange': loadModule('lib/chartRange.ts').exports,
    }).exports.default;
    renderToStaticMarkup(React.createElement(Chart, {
      biometrics, profile: { height: 175, height_unit: 'cm' }, rangeYears: 'all', weightDisplayUnit: unit,
      bodyFatEstimates: withEstimate ? [
        { date: '2026-10-28', percentage: 24, method: 'rfm' },
        { date: '2026-10-30', percentage: 22.8, method: 'rfm' },
      ] : [],
    }));
    const composition = charts.find((chart) => chart.lines.some((line) => line.dataKey === 'muscleMass'));
    assert.ok(composition);
    assert.equal(charts.length, 2);
    assert.deepEqual(composition.lines.map((line) => line.dataKey), withEstimate
      ? ['averageBodyFatPercentage', 'bodyFatPercentage', 'estimatedBodyFatPercentage', 'muscleMass', 'weight']
      : ['averageBodyFatPercentage', 'bodyFatPercentage', 'muscleMass', 'weight']);
    assert.equal(composition.lines[0].hide, false);
    assert.equal(composition.lines.find((line) => line.dataKey === 'bodyFatPercentage').hide, true);
    assert.ok(composition.zones.length > 0);
    assert.ok(composition.zones.every((zone) => zone.yAxisId === 'mass' && zone.x2 > zone.x1));
    assert.equal(composition.data[0].averageBodyFatPercentage, withEstimate ? 22 : 20);
    assert.equal(composition.data[0].healthRisk, Number(healthRisk.calculateHealthRiskIndicator(20).toFixed(3)));
    assert.equal(composition.lines[0].yAxisId, 'percentage');
    assert.equal(composition.lines.find((line) => line.dataKey === 'muscleMass').yAxisId, 'mass');
    assert.equal(composition.lines.find((line) => line.dataKey === 'weight').yAxisId, 'mass');
    assert.equal(composition.axes.find((axis) => axis.yAxisId === 'percentage').tickFormatter(15), '15%');
    assert.equal(composition.axes.find((axis) => axis.yAxisId === 'mass').orientation, 'right');
    const lastIndex = 3;
    assert.equal(composition.data.length, 4);
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
      assert.equal(estimateLine.hide, true);
      assert.equal(composition.data[2].estimatedBodyFatPercentage, 22.8);
      assert.equal(composition.data[2].bodyFatPercentage, undefined);
      assert.equal(composition.data[2].averageBodyFatPercentage, 22.8);
      assert.equal(composition.data[2].normalizedBodyFat, undefined);
      const waistRisk = healthRisk.calculateHealthRiskIndicator(20, 85 / 175);
      assert.equal(composition.data[2].averagedNormalizedRisk, Number(waistRisk.toFixed(3)));
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
    assert.doesNotMatch(tooltip, /Athletic|Fitness/);
    assert.match(tooltip, /Low Risk/);
    assert.match(tooltip, withEstimate ? /Same-day average/ : /single available source/);

    for (const entries of [biometrics.slice(0, 3), biometrics.slice(0, 4)]) {
      renderToStaticMarkup(React.createElement(Chart, {
        biometrics: entries, profile: null, rangeYears: 'all', weightDisplayUnit: unit,
      }));
      const edgeChart = charts[charts.length - 1];
      assert.equal(edgeChart.zones.length, 1);
      assert.ok(edgeChart.zones[0].x2 > edgeChart.zones[0].x1);
      if (entries.length === 4) {
        assert.ok(edgeChart.zones[0].x2 < new Date(entries[3].date).getTime());
      }
    }
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
    assert.match(text, /wake_date = \$1::date/);
    assert.match(text, /SELECT \$1::date, \$2/);
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

test('visceral fat scale position uses the entry bounds and clamps out-of-range values', () => {
  const { getVisceralFatScaleRatio } = loadModule('lib/healthRisk.ts').exports;
  const entry = {
    date: '2026-10-31', metric_type: 'visceral_fat_level', unit: 'level',
    value: 10, scale_min: 5, scale_max: 25,
  };
  assert.equal(getVisceralFatScaleRatio(entry), 0.25);
  assert.equal(getVisceralFatScaleRatio({ ...entry, value: 15 }), 0.5);
  assert.equal(getVisceralFatScaleRatio({ ...entry, value: 5 }), 0);
  assert.equal(getVisceralFatScaleRatio({ ...entry, value: 25 }), 1);
  assert.equal(getVisceralFatScaleRatio({ ...entry, value: 0 }), 0);
  assert.equal(getVisceralFatScaleRatio({ ...entry, value: 30 }), 1);
  assert.equal(getVisceralFatScaleRatio({ ...entry, value: 0, scale_min: 0 }), 0);
  for (const invalid of [
    undefined, { ...entry, scale_min: null }, { ...entry, scale_max: undefined },
    { ...entry, scale_max: 5 }, { ...entry, scale_max: 4 },
    { ...entry, scale_min: NaN }, { ...entry, scale_max: Infinity },
    { ...entry, value: NaN }, { ...entry, value: Infinity },
  ]) {
    assert.equal(getVisceralFatScaleRatio(invalid), null);
  }
});

test('visceral fat chart data normalizes every entry independently and preserves missing ranges', () => {
  const { getVisceralFatChartData } = loadModule('lib/dashboardMetrics.ts', {
    '@/lib/healthRisk': loadModule('lib/healthRisk.ts').exports,
    '@/lib/weight': loadModule('lib/weight.ts').exports,
    '@/lib/nutritionSummary': loadModule('lib/nutritionSummary.ts').exports,
  }).exports;
  const base = { date: '2026-10-31', metric_type: 'visceral_fat_level', unit: 'level' };
  const entries = [
    { ...base, value: 15, scale_min: 10, scale_max: 20, created_at: '2026-10-31T09:00:00Z' },
    { ...base, value: 15, scale_min: 0, scale_max: 30, date: '2026-10-29' },
    { ...base, value: 15, scale_min: 5, scale_max: 45, created_at: '2026-10-31T08:00:00Z' },
    { ...base, value: 15, date: '2026-10-30' },
    { ...base, value: 10, metric_type: 'body_fat_percentage' },
  ];
  const original = JSON.stringify(entries);
  const points = getVisceralFatChartData(entries);
  assert.equal(JSON.stringify(points.map(point => point.ratio)), '[0.5,null,0.25,0.5]');
  assert.equal(points[2].scale_min, 5);
  assert.equal(points[3].scale_max, 20);
  assert.equal(JSON.stringify(entries), original);
});

test('visceral fat plot uses a fixed 0-1 axis, range filtering, gaps, and original-value tooltips', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const metrics = loadModule('lib/dashboardMetrics.ts', {
    '@/lib/healthRisk': loadModule('lib/healthRisk.ts').exports,
    '@/lib/weight': loadModule('lib/weight.ts').exports,
    '@/lib/nutritionSummary': loadModule('lib/nutritionSummary.ts').exports,
  }).exports;
  let chart;
  const container = ({ children }) => children ?? null;
  const Chart = loadModule('components/VisceralFatChart.tsx', {
    '@/lib/dashboardMetrics': metrics,
    '@/lib/chartRange': loadModule('lib/chartRange.ts').exports,
    recharts: {
      ResponsiveContainer: container, CartesianGrid: () => null,
      LineChart: ({ data, children }) => { chart = { data }; return children; },
      XAxis: (props) => { chart.xAxis = props; return null; },
      YAxis: (props) => { chart.yAxis = props; return null; },
      ReferenceArea: () => null,
      Tooltip: ({ content }) => { chart.tooltip = content; return null; },
      Line: (props) => { chart.line = props; return null; },
    },
  }).exports.default;
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const base = { date, metric_type: 'visceral_fat_level', value: 24, unit: 'level', scale_min: 0, scale_max: 30 };
  const biometrics = [
    { ...base, date: '2000-01-01', value: 0 },
    { ...base, scale_max: undefined },
    base,
  ];
  const render = (props = {}) => renderToStaticMarkup(React.createElement(Chart, {
    biometrics, rangeYears: 'all', loading: false, ...props,
  }));
  const html = render();
  assert.equal(JSON.stringify(chart.yAxis.domain), '[0,1]');
  assert.equal(chart.xAxis.scale, 'time');
  assert.equal(JSON.stringify(chart.data.map(point => point.ratio)), '[0,null,0.8]');
  assert.equal(chart.line.connectNulls, false);
  assert.match(html, /1 measurement\(s\).*not plotted/);
  const tooltip = renderToStaticMarkup(React.cloneElement(chart.tooltip, {
    active: true, payload: [{ payload: chart.data[2] }],
  }));
  assert.match(tooltip, /0\.800 \(80%\)/);
  assert.match(tooltip, /Visceral fat: 24 level/);
  assert.match(tooltip, /Device range: 0 to 30/);
  const zeroDot = renderToStaticMarkup(chart.line.dot({ cx: 10, cy: 10, payload: chart.data[0] }));
  assert.match(zeroDot, /fill="hsl\(120, 75%, 45%\)"/);
  assert.equal(renderToStaticMarkup(chart.line.dot({ cx: 10, cy: 10, payload: chart.data[1] })), '');
  render({ rangeYears: 1 });
  assert.equal(JSON.stringify(chart.data.map(point => point.ratio)), '[null,0.8]');
  assert.match(render({ biometrics: [] }), /No scaled visceral fat measurements/);
  assert.match(render({ loading: true }), /Loading visceral fat data/);
  assert.match(render({ error: 'Unable to load biometric data.' }), /role="alert".*Unable to load biometric data/);
});

test('stat cards render dynamic border colors without changing the neutral default', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const StatCard = loadModule('components/StatCard.tsx').exports.default;
  const props = { title: 'Visceral Fat Level', value: 10 };
  const colored = renderToStaticMarkup(React.createElement(StatCard, {
    ...props, style: { borderColor: 'hsl(60, 75%, 45%)' },
  }));
  assert.match(colored, /style="border-color:hsl\(60, 75%, 45%\)"/);
  assert.match(colored, /Visceral Fat Level/);
  const neutral = renderToStaticMarkup(React.createElement(StatCard, props));
  assert.match(neutral, /border-blue-200 dark:border-blue-700/);
  assert.doesNotMatch(neutral, /style=/);
});

test('seven-day nutrition average uses only recorded days and reports coverage', () => {
  const { getSevenDayCalorieSummary } = loadModule('lib/dashboardMetrics.ts', {
    '@/lib/healthRisk': loadModule('lib/healthRisk.ts').exports,
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
    '@/lib/healthRisk': loadModule('lib/healthRisk.ts').exports,
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
    '@/lib/healthRisk': loadModule('lib/healthRisk.ts').exports,
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
    '@/lib/healthRisk': loadModule('lib/healthRisk.ts').exports,
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

test('chart ranges support calendar months, three years, custom durations, and month-end clamping', () => {
  const { getChartRangeStart, getChartRangeLabel, isValidChartRange } = loadModule('lib/chartRange.ts').exports;
  const today = new Date(2026, 10, 3, 12);
  const sixMonths = getChartRangeStart(0.5, today);
  assert.equal(sixMonths.getFullYear(), 2026);
  assert.equal(sixMonths.getMonth(), 4);
  assert.equal(sixMonths.getDate(), 3);
  assert.equal(getChartRangeStart(3, today).getFullYear(), 2023);
  assert.equal(getChartRangeStart(9 / 12, today).getMonth(), 1);
  assert.equal(getChartRangeStart(1 / 12, new Date(2026, 2, 31)).getDate(), 28);
  assert.equal(getChartRangeStart(1, new Date(2024, 1, 29)).getDate(), 28);
  assert.equal(today.getMonth(), 10);
  assert.equal(getChartRangeLabel(0.5), 'Last 6 months');
  assert.equal(getChartRangeLabel(3), 'Last 3 years');
  assert.equal(getChartRangeLabel(9 / 12), 'Last 9 months');
  assert.equal(getChartRangeLabel('all'), 'All available data');
  for (const range of [0.5, 1, 2, 3, 5, 1 / 12, 9 / 12, 100]) assert.equal(isValidChartRange(range), true);
  for (const range of [0, -1, NaN, Infinity, 101, 0.123]) assert.equal(isValidChartRange(range), false);
});

test('weight stress windows merge consecutive days without crossing gaps or low stress', () => {
  const weight = loadModule('lib/weight.ts').exports;
  const { buildWeightStressTimeline } = loadModule('lib/insights.ts', {
    '@/lib/weight': weight,
    '@/lib/calorieEstimate': {},
    '@/lib/sleepSummary': {},
    '@/lib/stressSummary': loadModule('lib/stressSummary.ts').exports,
    '@/lib/nutritionSummary': {},
  }).exports;
  const biometrics = [
    { date: '2026-10-24', metric_type: 'weight', value: 70, unit: 'kg' },
    { date: '2026-10-25', metric_type: 'weight', value: 80, unit: 'kg' },
    { date: '2026-10-25', metric_type: 'weight', value: weight.kilogramsToPounds(82), unit: 'lbs' },
    { date: '2026-10-26', metric_type: 'waistline', value: 85, unit: 'cm' },
    { date: '2026-10-27', metric_type: 'weight', value: -1, unit: 'kg' },
    { date: '2026-11-01', metric_type: 'weight', value: 90, unit: 'kg' },
  ];
  const stress = [
    { date: '2026-10-24', stress_level: 9 },
    { date: '2026-10-25', stress_level: 6 },
    { date: '2026-10-25', stress_level: 10 },
    { date: '2026-10-26', stress_level: 9 },
    { date: '2026-10-28', stress_level: 8 },
    { date: '2026-10-29', stress_level: 3 },
    { date: '2026-10-30', stress_level: 7 },
    { date: '2026-10-31', stress_level: 8 },
  ];
  for (const unit of ['kg', 'lbs']) {
    const { points, windows } = buildWeightStressTimeline(biometrics, stress, '2026-10-25', '2026-10-31', unit);
    assert.equal(points.length, 7);
    assert.ok(Math.abs(points[0].weight - (unit === 'kg' ? 81 : weight.kilogramsToPounds(81))) < 0.001);
    assert.equal(points[0].stressLevel, 8);
    assert.equal(points[1].weight, undefined);
    assert.equal(points[2].weight, undefined);
    assert.equal(points[2].stressLevel, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(windows)), [
      { start: Date.parse('2026-10-25Z'), end: Date.parse('2026-10-27Z'), level: 'high' },
      { start: Date.parse('2026-10-28Z'), end: Date.parse('2026-10-29Z'), level: 'high' },
      { start: Date.parse('2026-10-30Z'), end: Date.parse('2026-10-31Z'), level: 'moderate' },
      { start: Date.parse('2026-10-31Z'), end: Date.parse('2026-11-01Z'), level: 'high' },
    ]);
  }
  const empty = buildWeightStressTimeline([], [], '2026-10-25', '2026-10-31', 'kg');
  assert.equal(empty.windows.length, 0);
  assert.ok(empty.points.every((point) => point.weight === undefined && point.stressLevel === undefined));
});

test('weight stress logging gaps exclude pre-tracking time and flag only immediately preceding high stress', () => {
  const { buildWeightStressTimeline } = loadModule('lib/insights.ts', {
    '@/lib/weight': loadModule('lib/weight.ts').exports,
    '@/lib/calorieEstimate': {},
    '@/lib/sleepSummary': {},
    '@/lib/stressSummary': loadModule('lib/stressSummary.ts').exports,
    '@/lib/nutritionSummary': {},
  }).exports;
  const biometrics = ['2026-10-10', '2026-10-15', '2026-10-18', '2026-10-22']
    .map((date) => ({ date, metric_type: 'weight', value: 80, unit: 'kg' }));
  const stress = [
    { date: '2026-10-10', stress_level: 9 },
    { date: '2026-10-15', stress_level: 6 },
    { date: '2026-10-18', stress_level: 2 },
    { date: '2026-10-22', stress_level: 9 },
  ];
  const { gaps } = buildWeightStressTimeline(biometrics, stress, '2026-10-01', '2026-10-25', 'kg', 3);
  assert.equal(gaps.length, 6);
  for (const metric of ['weight', 'stress']) {
    const matching = gaps.filter((gap) => gap.metric === metric);
    assert.deepEqual(JSON.parse(JSON.stringify(matching)), [
      { start: Date.parse('2026-10-11Z'), end: Date.parse('2026-10-15Z'), days: 4, metric, afterHighStress: true },
      { start: Date.parse('2026-10-19Z'), end: Date.parse('2026-10-22Z'), days: 3, metric, afterHighStress: false },
      { start: Date.parse('2026-10-23Z'), end: Date.parse('2026-10-26Z'), days: 3, metric, afterHighStress: true },
    ]);
  }
  const ranged = buildWeightStressTimeline(biometrics, stress, '2026-10-13', '2026-10-14', 'kg', 3);
  assert.equal(ranged.gaps.length, 2);
  assert.ok(ranged.gaps.every((gap) => gap.start === Date.parse('2026-10-11Z') && gap.afterHighStress));
  const absentStress = buildWeightStressTimeline(biometrics, [], '2026-10-01', '2026-10-25', 'kg');
  assert.ok(absentStress.gaps.every((gap) => gap.metric === 'weight' && !gap.afterHighStress));
  const empty = buildWeightStressTimeline([], [], '2026-10-01', '2026-10-25', 'kg');
  assert.equal(empty.gaps.length, 0);

  const weeklyWeights = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-10-07']
    .map((date) => ({ date, metric_type: 'weight', value: 80, unit: 'kg' }));
  const defaultGaps = buildWeightStressTimeline(weeklyWeights, [], '2026-09-01', '2026-10-07', 'kg').gaps;
  assert.equal(defaultGaps.length, 1);
  assert.equal(defaultGaps[0].days, 21);
  assert.equal(defaultGaps[0].start, Date.parse('2026-09-16Z'));
  assert.equal(buildWeightStressTimeline(weeklyWeights, [], '2026-09-01', '2026-10-07', 'kg', 22).gaps.length, 0);
  assert.equal(buildWeightStressTimeline(weeklyWeights, [], '2026-09-01', '2026-10-07', 'kg', 6).gaps.length, 3);
  for (const invalid of [0, -1, 1.5, NaN, 366]) {
    assert.equal(buildWeightStressTimeline(weeklyWeights, [], '2026-09-01', '2026-10-07', 'kg', invalid).gaps.length, 1);
  }
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