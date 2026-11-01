import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { SleepEntry } from '@/lib/types';

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const body: SleepEntry = await request.json();

    if (!body.wake_date || !body.bedtime || !body.wake_time || body.sleep_duration_minutes === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: wake_date, bedtime, wake_time, sleep_duration_minutes' },
        { status: 400 }
      );
    }

    if (!isValidDate(body.wake_date) || !isValidTime(body.bedtime) || !isValidTime(body.wake_time)) {
      return NextResponse.json(
        { error: 'Wake date and sleep times must be valid' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(body.sleep_duration_minutes) || body.sleep_duration_minutes < 1 || body.sleep_duration_minutes > 1440) {
      return NextResponse.json(
        { error: 'Sleep duration must be between 1 and 1440 minutes' },
        { status: 400 }
      );
    }

    if (body.restedness !== undefined && (!Number.isInteger(body.restedness) || body.restedness < 1 || body.restedness > 5)) {
      return NextResponse.json(
        { error: 'Restedness must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    const data = await query<SleepEntry>(
      `INSERT INTO sleep_entries
       (wake_date, bedtime, wake_time, sleep_duration_minutes, restedness, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [body.wake_date, body.bedtime, body.wake_time, body.sleep_duration_minutes,
        body.restedness ?? null, body.notes || null],
    );

    return NextResponse.json(
      { message: 'Sleep data saved successfully', data },
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
    const data = await query<SleepEntry>(
      'SELECT * FROM sleep_entries ORDER BY wake_date DESC LIMIT 500',
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