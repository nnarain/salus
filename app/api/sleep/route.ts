import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { SleepEntry } from '@/lib/types';

type SleepEntryInput = Omit<SleepEntry, 'sleep_duration_minutes'> & { sleep_duration_minutes?: number };

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function durationBetweenTimes(bedtime: string, wakeTime: string): number {
  const minutes = (time: string) => {
    const [hours, remainder] = time.split(':').map(Number);
    return hours * 60 + remainder;
  };
  return (minutes(wakeTime) - minutes(bedtime) + 1440) % 1440 || 1440;
}

export async function POST(request: NextRequest) {
  try {
    const body: SleepEntryInput = await request.json();

    if (!body.wake_date || !body.bedtime || !body.wake_time) {
      return NextResponse.json(
        { error: 'Missing required fields: wake_date, bedtime, wake_time' },
        { status: 400 }
      );
    }

    if (!isValidDate(body.wake_date) || !isValidTime(body.bedtime) || !isValidTime(body.wake_time)) {
      return NextResponse.json(
        { error: 'Wake date and sleep times must be valid' },
        { status: 400 }
      );
    }

    const sleepDurationMinutes = body.sleep_duration_minutes ?? durationBetweenTimes(body.bedtime, body.wake_time);
    if (!Number.isInteger(sleepDurationMinutes) || sleepDurationMinutes < 1 || sleepDurationMinutes > 1440) {
      return NextResponse.json(
        { error: 'Sleep duration must be between 1 and 1440 minutes' },
        { status: 400 }
      );
    }

    if (body.restedness != null && (!Number.isInteger(body.restedness) || body.restedness < 1 || body.restedness > 5)) {
      return NextResponse.json(
        { error: 'Restedness must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    const data = await query<SleepEntry>(
      `WITH date_lock AS MATERIALIZED (
         SELECT pg_advisory_xact_lock(hashtext($1::text))
       ), updated AS (
         UPDATE sleep_entries
         SET bedtime = $2, wake_time = $3, sleep_duration_minutes = $4, restedness = $5, notes = $6
         WHERE id = (
           SELECT id FROM sleep_entries, date_lock
           WHERE wake_date = $1::date
           ORDER BY created_at DESC, id DESC
           LIMIT 1
         )
         RETURNING *
       ), inserted AS (
         INSERT INTO sleep_entries
           (wake_date, bedtime, wake_time, sleep_duration_minutes, restedness, notes)
         SELECT $1::date, $2, $3, $4, $5, $6
         WHERE NOT EXISTS (SELECT 1 FROM updated)
         RETURNING *
       )
       SELECT * FROM updated
       UNION ALL
       SELECT * FROM inserted`,
      [body.wake_date, body.bedtime, body.wake_time, sleepDurationMinutes,
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