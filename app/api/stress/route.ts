import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { StressEntry } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: StressEntry = await request.json();

    // Validate required fields
    if (!body.date || body.stress_level === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: date, stress_level' },
        { status: 400 }
      );
    }

    // Validate stress_level range
    if (body.stress_level < 1 || body.stress_level > 10) {
      return NextResponse.json(
        { error: 'stress_level must be between 1 and 10' },
        { status: 400 }
      );
    }

    const data = await query<StressEntry>(
      `INSERT INTO stress (date, stress_level, notes)
       VALUES ($1, $2, $3) RETURNING *`,
      [body.date, body.stress_level, body.notes || null],
    );

    return NextResponse.json(
      { message: 'Stress data saved successfully', data },
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
    const data = await query<StressEntry>(
      'SELECT * FROM stress ORDER BY date DESC LIMIT 500',
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
