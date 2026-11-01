import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ActivityEntry } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: ActivityEntry = await request.json();

    // Validate required fields
    if (!body.date || !body.activity_name || !body.activity_type || body.effort_level === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: date, activity_name, activity_type, effort_level' },
        { status: 400 }
      );
    }

    // Validate activity_type
    if (!['strength', 'cardio'].includes(body.activity_type)) {
      return NextResponse.json(
        { error: 'activity_type must be either "strength" or "cardio"' },
        { status: 400 }
      );
    }

    // Validate effort_level range
    if (body.effort_level < 1 || body.effort_level > 10) {
      return NextResponse.json(
        { error: 'effort_level must be between 1 and 10' },
        { status: 400 }
      );
    }

    // Validate duration if provided
    if (body.duration_minutes !== undefined && body.duration_minutes < 0) {
      return NextResponse.json(
        { error: 'duration_minutes must be a positive number' },
        { status: 400 }
      );
    }

    const data = await query<ActivityEntry>(
      `INSERT INTO activities
       (date, activity_name, activity_type, effort_level, duration_minutes, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [body.date, body.activity_name, body.activity_type, body.effort_level,
        body.duration_minutes || null, body.notes || null],
    );

    return NextResponse.json(
      { message: 'Activity data saved successfully', data },
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
    const data = await query<ActivityEntry>(
      'SELECT * FROM activities ORDER BY date DESC LIMIT 500',
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
