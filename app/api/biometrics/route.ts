import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { BiometricEntry } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: BiometricEntry = await request.json();

    // Validate required fields
    if (!body.date || !body.metric_type || !body.value || !body.unit) {
      return NextResponse.json(
        { error: 'Missing required fields: date, metric_type, value, unit' },
        { status: 400 }
      );
    }

    // Validate value is a positive number
    if (body.value <= 0) {
      return NextResponse.json(
        { error: 'Value must be a positive number' },
        { status: 400 }
      );
    }

    const data = await query<BiometricEntry>(
      `INSERT INTO biometrics (date, metric_type, value, unit, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [body.date, body.metric_type, body.value, body.unit, body.notes || null],
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

export async function GET() {
  try {
    const data = await query<BiometricEntry>(
      'SELECT * FROM biometrics ORDER BY date DESC LIMIT 500',
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
