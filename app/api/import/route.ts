import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { normalizeWeightToKilograms } from '@/lib/weight';

interface ImportRequest {
  dataType: 'biometric' | 'activity' | 'stress';
  csvData: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

function parseCSV(csvData: string): Record<string, string>[] {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = line.split(',').map(v => v.trim());
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });

    records.push(record);
  }

  return records;
}

function validateBiometricRecord(record: Record<string, string>): boolean {
  if (!record.date || !record.metric_type || !record.value || !record.unit) return false;

  const value = parseFloat(record.value);
  const isVisceralFat = record.metric_type === 'visceral_fat_level';
  if (!Number.isFinite(value) || (isVisceralFat ? value < 0 || record.unit !== 'level' : value <= 0)) return false;
  if (record.metric_type === 'weight' && normalizeWeightToKilograms(value, record.unit) === null) return false;
  if (record.metric_type === 'muscle_mass' && record.unit !== 'kg') return false;

  const hasScaleMin = record.scale_min !== undefined && record.scale_min !== '';
  const hasScaleMax = record.scale_max !== undefined && record.scale_max !== '';
  if ((hasScaleMin || hasScaleMax) && !isVisceralFat) return false;
  if (hasScaleMin !== hasScaleMax) return false;
  if (hasScaleMin && hasScaleMax) {
    const scaleMin = parseFloat(record.scale_min);
    const scaleMax = parseFloat(record.scale_max);
    if (!Number.isFinite(scaleMin) || !Number.isFinite(scaleMax) || scaleMin >= scaleMax || value < scaleMin || value > scaleMax) {
      return false;
    }
  }

  return true;
}

function validateActivityRecord(record: Record<string, string>): boolean {
  const effortLevel = parseInt(record.effort_level, 10);
  return !!(
    record.date &&
    record.activity_name &&
    record.activity_type &&
    record.effort_level &&
    !isNaN(effortLevel) &&
    effortLevel >= 1 &&
    effortLevel <= 10 &&
    (record.activity_type === 'strength' || record.activity_type === 'cardio')
  );
}

function validateStressRecord(record: Record<string, string>): boolean {
  const stressLevel = parseInt(record.stress_level, 10);
  return !!(
    record.date &&
    record.stress_level &&
    !isNaN(stressLevel) &&
    stressLevel >= 1 &&
    stressLevel <= 10
  );
}

export async function POST(request: Request) {
  try {
    const body: ImportRequest = await request.json();
    const { dataType, csvData } = body;

    if (!csvData) {
      return NextResponse.json(
        { error: 'CSV data is required' },
        { status: 400 }
      );
    }

    const records = parseCSV(csvData);
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    for (const record of records) {
      try {
        if (dataType === 'biometric') {
          if (!validateBiometricRecord(record)) {
            result.skipped++;
            result.errors.push(`Invalid biometric record: ${JSON.stringify(record)}`);
            continue;
          }

          await query(
            `INSERT INTO biometrics (date, metric_type, value, unit, scale_min, scale_max, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [record.date, record.metric_type,
              record.metric_type === 'weight'
                ? normalizeWeightToKilograms(parseFloat(record.value), record.unit)
                : parseFloat(record.value),
              record.metric_type === 'weight' ? 'kg' : record.unit,
              record.scale_min ? parseFloat(record.scale_min) : null,
              record.scale_max ? parseFloat(record.scale_max) : null,
              record.notes || null],
          );
          result.imported++;
        } else if (dataType === 'activity') {
          if (!validateActivityRecord(record)) {
            result.skipped++;
            result.errors.push(`Invalid activity record: ${JSON.stringify(record)}`);
            continue;
          }

          await query(
            `INSERT INTO activities
             (date, activity_name, activity_type, effort_level, duration_minutes, notes)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [record.date, record.activity_name, record.activity_type,
              parseInt(record.effort_level, 10),
              record.duration_minutes ? parseInt(record.duration_minutes, 10) : null,
              record.notes || null],
          );
          result.imported++;
        } else if (dataType === 'stress') {
          if (!validateStressRecord(record)) {
            result.skipped++;
            result.errors.push(`Invalid stress record: ${JSON.stringify(record)}`);
            continue;
          }

          await query(
            'INSERT INTO stress (date, stress_level, notes) VALUES ($1, $2, $3)',
            [record.date, parseInt(record.stress_level, 10), record.notes || null],
          );
          result.imported++;
        }
      } catch (error) {
        console.error('Error importing record:', error);
        result.skipped++;
        result.errors.push('Error importing record: Failed to save record');
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import data' },
      { status: 500 }
    );
  }
}
