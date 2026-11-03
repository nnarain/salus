import { NextResponse } from 'next/server';
import { normalizeWeightToKilograms } from '@/lib/weight';
import { query } from '@/lib/db';

export type EntryResource = 'activities' | 'biometrics' | 'nutrition' | 'sleep' | 'stress';

type EntryRecord = Record<string, unknown> & { id: string };

const RESOURCE_CONFIG: Record<EntryResource, { table: string; fields: string[] }> = {
  activities: {
    table: 'activities',
    fields: ['date', 'activity_name', 'activity_type', 'effort_level', 'duration_minutes', 'notes'],
  },
  biometrics: {
    table: 'biometrics',
    fields: ['date', 'metric_type', 'value', 'unit', 'scale_min', 'scale_max', 'notes'],
  },
  nutrition: {
    table: 'nutrition_entries',
    fields: ['date', 'calories_kcal', 'protein_grams', 'water_ml', 'estimated', 'partial', 'notes'],
  },
  sleep: {
    table: 'sleep_entries',
    fields: ['wake_date', 'bedtime', 'wake_time', 'sleep_duration_minutes', 'restedness', 'notes'],
  },
  stress: {
    table: 'stress',
    fields: ['date', 'stress_level', 'notes'],
  },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isOptionalText(value: unknown): boolean {
  return value == null || typeof value === 'string';
}

function validationError(resource: EntryResource, entry: EntryRecord): string | null {
  if (!isOptionalText(entry.notes)) return 'Notes must be a string or null';

  if (resource === 'activities') {
    if (!isValidDate(entry.date) || typeof entry.activity_name !== 'string' || !entry.activity_name.trim()) {
      return 'Date and activity name are required';
    }
    if (entry.activity_type !== 'strength' && entry.activity_type !== 'cardio') {
      return 'Activity type must be strength or cardio';
    }
    if (!Number.isInteger(entry.effort_level) || Number(entry.effort_level) < 1 || Number(entry.effort_level) > 10) {
      return 'Effort level must be an integer between 1 and 10';
    }
    if (entry.duration_minutes != null && (!Number.isInteger(entry.duration_minutes) || Number(entry.duration_minutes) < 0)) {
      return 'Duration must be a non-negative whole number or null';
    }
  }

  if (resource === 'biometrics') {
    const metricTypes = ['weight', 'waistline', 'body_fat_percentage', 'visceral_fat_level', 'muscle_mass'];
    if (!isValidDate(entry.date) || !metricTypes.includes(String(entry.metric_type))) return 'Date and a supported metric type are required';
    if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)
      || (entry.metric_type === 'visceral_fat_level' ? entry.value < 0 : entry.value <= 0)) {
      return 'Metric value is invalid';
    }

    const allowedUnits: Record<string, string[]> = {
      weight: ['kg', 'lbs'], waistline: ['cm', 'inches'], body_fat_percentage: ['%'],
      visceral_fat_level: ['level'], muscle_mass: ['kg'],
    };
    if (!allowedUnits[String(entry.metric_type)]?.includes(String(entry.unit))) return 'Unit is incompatible with metric type';

    const hasScaleMin = entry.scale_min != null;
    const hasScaleMax = entry.scale_max != null;
    if ((hasScaleMin || hasScaleMax) && entry.metric_type !== 'visceral_fat_level') return 'Scale bounds are only supported for visceral fat';
    if (hasScaleMin !== hasScaleMax) return 'Both scale bounds are required';
    if (hasScaleMin && hasScaleMax && (
      typeof entry.scale_min !== 'number' || typeof entry.scale_max !== 'number'
      || !Number.isFinite(entry.scale_min) || !Number.isFinite(entry.scale_max)
      || entry.scale_min >= entry.scale_max || entry.value < entry.scale_min || entry.value > entry.scale_max
    )) return 'Scale bounds must be ordered and include the metric value';
  }

  if (resource === 'nutrition') {
    if (!isValidDate(entry.date)) return 'Date is invalid';
    if ([entry.calories_kcal, entry.protein_grams, entry.water_ml].every((value) => value == null)) {
      return 'At least one nutrition value is required';
    }
    if (entry.calories_kcal != null && (!Number.isInteger(entry.calories_kcal) || Number(entry.calories_kcal) < 0)) {
      return 'Calories must be a non-negative whole number or null';
    }
    if (entry.protein_grams != null && (typeof entry.protein_grams !== 'number'
      || !Number.isFinite(entry.protein_grams) || entry.protein_grams < 0)) return 'Protein must be non-negative or null';
    if (entry.water_ml != null && (!Number.isInteger(entry.water_ml) || Number(entry.water_ml) < 0)) {
      return 'Water must be a non-negative whole number or null';
    }
    if (typeof entry.estimated !== 'boolean' || typeof entry.partial !== 'boolean') return 'Estimated and partial must be booleans';
  }

  if (resource === 'sleep') {
    if (!isValidDate(entry.wake_date) || !isValidTime(entry.bedtime) || !isValidTime(entry.wake_time)) {
      return 'Wake date and sleep times must be valid';
    }
    if (!Number.isInteger(entry.sleep_duration_minutes) || Number(entry.sleep_duration_minutes) < 1
      || Number(entry.sleep_duration_minutes) > 1440) return 'Sleep duration must be between 1 and 1440 minutes';
    if (entry.restedness != null && (!Number.isInteger(entry.restedness)
      || Number(entry.restedness) < 1 || Number(entry.restedness) > 5)) return 'Restedness must be an integer between 1 and 5 or null';
  }

  if (resource === 'stress') {
    if (!isValidDate(entry.date) || !Number.isInteger(entry.stress_level)
      || Number(entry.stress_level) < 1 || Number(entry.stress_level) > 10) return 'Date and stress level must be valid';
  }

  return null;
}

export async function patchEntry(resource: EntryResource, id: string, request: Request) {
  const config = RESOURCE_CONFIG[resource];
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Entry ID must be a UUID' }, { status: 400 });

  let changes: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }
    changes = body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const fields = Object.keys(changes);
  if (fields.length === 0 || fields.some((field) => !config.fields.includes(field))) {
    return NextResponse.json({ error: 'Request must contain editable fields only' }, { status: 400 });
  }

  try {
    const [existing] = await query<EntryRecord>(`SELECT * FROM ${config.table} WHERE id = $1`, [id]);
    if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    const updatedEntry = { ...existing, ...changes };
    const error = validationError(resource, updatedEntry);
    if (error) return NextResponse.json({ error }, { status: 400 });

    if (resource === 'biometrics' && updatedEntry.metric_type === 'weight'
      && changes.unit !== undefined && changes.value === undefined) {
      return NextResponse.json({ error: 'Provide the value when changing a weight unit' }, { status: 400 });
    }

    if (resource === 'biometrics' && updatedEntry.metric_type === 'weight'
      && (changes.value !== undefined || changes.unit !== undefined)) {
      const value = normalizeWeightToKilograms(Number(updatedEntry.value), String(updatedEntry.unit));
      if (value === null) return NextResponse.json({ error: 'Weight unit must be kg or lbs' }, { status: 400 });
      changes.value = value;
      changes.unit = 'kg';
    }

    const updateFields = Object.keys(changes);
    const assignments = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const values = updateFields.map((field) => changes[field]);
    const [data] = await query<EntryRecord>(
      `UPDATE ${config.table} SET ${assignments} WHERE id = $${values.length + 1} RETURNING *`,
      [...values, id],
    );
    if (!data) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    return NextResponse.json({ message: 'Entry updated successfully', data }, { status: 200 });
  } catch (error) {
    console.error(`Error updating ${resource} entry:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function deleteEntry(resource: EntryResource, id: string) {
  const config = RESOURCE_CONFIG[resource];
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Entry ID must be a UUID' }, { status: 400 });

  try {
    const [data] = await query<EntryRecord>(`DELETE FROM ${config.table} WHERE id = $1 RETURNING *`, [id]);
    if (!data) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    return NextResponse.json({ message: 'Entry deleted successfully', data }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting ${resource} entry:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}