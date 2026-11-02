import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { normalizeWeightToKilograms } from '@/lib/weight';
import type { BiometricEntry } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: BiometricEntry = await request.json();

    // Validate required fields
    if (!body.date || !body.metric_type || body.value === undefined || !body.unit) {
      return NextResponse.json(
        { error: 'Missing required fields: date, metric_type, value, unit' },
        { status: 400 }
      );
    }

    const isVisceralFat = body.metric_type === 'visceral_fat_level';
    if (!Number.isFinite(body.value) || (isVisceralFat ? body.value < 0 : body.value <= 0)) {
      return NextResponse.json(
        { error: isVisceralFat ? 'Visceral fat level must be a non-negative number' : 'Value must be a positive number' },
        { status: 400 }
      );
    }

    if (isVisceralFat && body.unit !== 'level') {
      return NextResponse.json({ error: 'Visceral fat level unit must be "level"' }, { status: 400 });
    }

    if (body.metric_type === 'muscle_mass' && body.unit !== 'kg') {
      return NextResponse.json({ error: 'Muscle mass unit must be "kg"' }, { status: 400 });
    }

    const hasScaleMin = body.scale_min !== undefined;
    const hasScaleMax = body.scale_max !== undefined;
    if ((hasScaleMin || hasScaleMax) && !isVisceralFat) {
      return NextResponse.json({ error: 'Scale bounds are only supported for visceral fat levels' }, { status: 400 });
    }
    if (hasScaleMin !== hasScaleMax) {
      return NextResponse.json({ error: 'Both scale minimum and maximum are required when specifying a scale range' }, { status: 400 });
    }
    if (hasScaleMin && hasScaleMax && (
      !Number.isFinite(body.scale_min) || !Number.isFinite(body.scale_max) ||
      body.scale_min! >= body.scale_max! || body.value < body.scale_min! || body.value > body.scale_max!
    )) {
      return NextResponse.json({ error: 'Scale range must be ordered and include the visceral fat level' }, { status: 400 });
    }

    const isWeight = body.metric_type === 'weight';
    const value = isWeight
      ? normalizeWeightToKilograms(body.value, body.unit)
      : body.value;
    if (value === null) {
      return NextResponse.json(
        { error: 'Weight unit must be kg or lbs' },
        { status: 400 }
      );
    }

    const data = await query<BiometricEntry>(
      `INSERT INTO biometrics (date, metric_type, value, unit, scale_min, scale_max, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.date, body.metric_type, value, isWeight ? 'kg' : body.unit,
        body.scale_min ?? null, body.scale_max ?? null, body.notes || null],
    );

    return NextResponse.json(
      { message: 'Biometric data saved successfully', data },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request?: NextRequest) {
  try {
    const latestScaleRange = request?.nextUrl.searchParams.get('latestScaleRange') === 'true';
    const data = await query<BiometricEntry>(
      latestScaleRange
        ? `SELECT * FROM biometrics
           WHERE metric_type = 'visceral_fat_level' AND scale_min IS NOT NULL AND scale_max IS NOT NULL
           ORDER BY created_at DESC, id DESC LIMIT 1`
        : 'SELECT * FROM biometrics ORDER BY date DESC LIMIT 500',
    );

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
