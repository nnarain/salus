import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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

    // Insert data into Supabase
    const { data, error } = await supabase
      .from('activities')
      .insert([
        {
          date: body.date,
          activity_name: body.activity_name,
          activity_type: body.activity_type,
          effort_level: body.effort_level,
          duration_minutes: body.duration_minutes || null,
          notes: body.notes || null,
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save activity data', details: error.message },
        { status: 500 }
      );
    }

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
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('date', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch activity data', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
