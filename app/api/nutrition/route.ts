import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { NutritionEntry } from '@/lib/types';

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function POST(request: NextRequest) {
  try {
    const body: NutritionEntry = await request.json();

    if (!body.date) {
      return NextResponse.json(
        { error: 'Missing required field: date' },
        { status: 400 }
      );
    }

    if (!isValidDate(body.date)) {
      return NextResponse.json({ error: 'Date must be a valid YYYY-MM-DD date' }, { status: 400 });
    }

    if (![body.calories_kcal, body.protein_grams, body.water_ml].some((value) => value != null)) {
      return NextResponse.json({ error: 'At least one nutrition value is required' }, { status: 400 });
    }

    if (body.calories_kcal != null && (!Number.isInteger(body.calories_kcal) || body.calories_kcal < 0)) {
      return NextResponse.json({ error: 'Calories must be a non-negative whole number' }, { status: 400 });
    }

    if (body.protein_grams != null && (!Number.isFinite(body.protein_grams) || body.protein_grams < 0)) {
      return NextResponse.json({ error: 'Protein must be a non-negative number of grams' }, { status: 400 });
    }

    if (body.water_ml != null && (!Number.isInteger(body.water_ml) || body.water_ml < 0)) {
      return NextResponse.json({ error: 'Water must be a non-negative whole number of milliliters' }, { status: 400 });
    }

    if (body.estimated !== undefined && typeof body.estimated !== 'boolean') {
      return NextResponse.json({ error: 'Estimated must be a boolean' }, { status: 400 });
    }

    if (body.partial !== undefined && typeof body.partial !== 'boolean') {
      return NextResponse.json({ error: 'Partial must be a boolean' }, { status: 400 });
    }

    const data = await query<NutritionEntry>(
      `INSERT INTO nutrition_entries
       (date, calories_kcal, protein_grams, water_ml, estimated, partial, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [body.date, body.calories_kcal ?? null, body.protein_grams ?? null, body.water_ml ?? null,
        body.estimated ?? false, body.partial ?? false, body.notes || null],
    );

    return NextResponse.json(
      { message: 'Nutrition entry saved successfully', data },
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

export async function GET() {
  try {
    const data = await query<NutritionEntry>(
      'SELECT * FROM nutrition_entries ORDER BY date DESC, created_at DESC LIMIT 5000',
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