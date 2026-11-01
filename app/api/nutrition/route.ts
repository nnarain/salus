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

    if (!body.date || body.calories_kcal === undefined || body.protein_grams === undefined || body.water_ml === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: date, calories_kcal, protein_grams, water_ml' },
        { status: 400 }
      );
    }

    if (!isValidDate(body.date)) {
      return NextResponse.json({ error: 'Date must be a valid YYYY-MM-DD date' }, { status: 400 });
    }

    if (!Number.isInteger(body.calories_kcal) || body.calories_kcal < 0) {
      return NextResponse.json({ error: 'Calories must be a non-negative whole number' }, { status: 400 });
    }

    if (!Number.isFinite(body.protein_grams) || body.protein_grams < 0) {
      return NextResponse.json({ error: 'Protein must be a non-negative number of grams' }, { status: 400 });
    }

    if (!Number.isInteger(body.water_ml) || body.water_ml < 0) {
      return NextResponse.json({ error: 'Water must be a non-negative whole number of milliliters' }, { status: 400 });
    }

    const data = await query<NutritionEntry>(
      `INSERT INTO nutrition_entries (date, calories_kcal, protein_grams, water_ml, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (date) DO UPDATE SET
         calories_kcal = EXCLUDED.calories_kcal,
         protein_grams = EXCLUDED.protein_grams,
         water_ml = EXCLUDED.water_ml,
         notes = EXCLUDED.notes
       RETURNING *`,
      [body.date, body.calories_kcal, body.protein_grams, body.water_ml, body.notes || null],
    );

    return NextResponse.json(
      { message: 'Nutrition data saved successfully', data },
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
      'SELECT * FROM nutrition_entries ORDER BY date DESC LIMIT 500',
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