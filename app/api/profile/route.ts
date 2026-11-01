import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { UserProfile } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: UserProfile = await request.json();

    // Validate height if provided
    if (body.height !== undefined && body.height <= 0) {
      return NextResponse.json(
        { error: 'Height must be a positive number' },
        { status: 400 }
      );
    }

    // Validate age if provided
    if (body.age !== undefined && (body.age < 0 || body.age > 150)) {
      return NextResponse.json(
        { error: 'Age must be between 0 and 150' },
        { status: 400 }
      );
    }

    if (body.biological_sex !== undefined && !['male', 'female'].includes(body.biological_sex)) {
      return NextResponse.json({ error: 'Biological sex must be male or female for the calorie formula' }, { status: 400 });
    }

    if (body.activity_level !== undefined && !['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(body.activity_level)) {
      return NextResponse.json({ error: 'Activity level is invalid' }, { status: 400 });
    }

    if (body.daily_calorie_target !== undefined && (!Number.isInteger(body.daily_calorie_target) || body.daily_calorie_target < 1 || body.daily_calorie_target > 10000)) {
      return NextResponse.json({ error: 'Daily calorie target must be between 1 and 10000 kcal' }, { status: 400 });
    }

    const result = await query<UserProfile>(
      `INSERT INTO user_profile
       (height, height_unit, age, notes, biological_sex, activity_level, daily_calorie_target)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (singleton) DO UPDATE SET
         height = EXCLUDED.height, height_unit = EXCLUDED.height_unit,
         age = EXCLUDED.age, notes = EXCLUDED.notes,
         biological_sex = EXCLUDED.biological_sex,
         activity_level = EXCLUDED.activity_level,
         daily_calorie_target = EXCLUDED.daily_calorie_target,
         updated_at = NOW()
       RETURNING id, created_at, updated_at, height, height_unit, age, notes,
         biological_sex, activity_level, daily_calorie_target`,
      [body.height ?? null, body.height_unit ?? null, body.age ?? null, body.notes ?? null,
        body.biological_sex ?? null, body.activity_level ?? null, body.daily_calorie_target ?? null],
    );

    return NextResponse.json(
      { message: 'Profile saved successfully', data: result },
      { status: 200 }
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
    const [data] = await query<UserProfile>(
      `SELECT id, created_at, updated_at, height, height_unit, age, notes,
        biological_sex, activity_level, daily_calorie_target
       FROM user_profile WHERE singleton = TRUE`,
    );

    return NextResponse.json({ data: data || null }, { status: 200 });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
