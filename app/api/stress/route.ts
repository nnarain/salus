import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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

    // Insert data into Supabase
    const { data, error } = await supabase
      .from('stress')
      .insert([
        {
          date: body.date,
          stress_level: body.stress_level,
          notes: body.notes || null,
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save stress data', details: error.message },
        { status: 500 }
      );
    }

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
    const { data, error } = await supabase
      .from('stress')
      .select('*')
      .order('date', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stress data', details: error.message },
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
