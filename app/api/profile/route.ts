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

    const result = await query<UserProfile>(
      `INSERT INTO user_profile (height, height_unit, age, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (singleton) DO UPDATE SET
         height = EXCLUDED.height, height_unit = EXCLUDED.height_unit,
         age = EXCLUDED.age, notes = EXCLUDED.notes, updated_at = NOW()
       RETURNING id, created_at, updated_at, height, height_unit, age, notes`,
      [body.height || null, body.height_unit || null, body.age || null, body.notes || null],
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
      `SELECT id, created_at, updated_at, height, height_unit, age, notes
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
