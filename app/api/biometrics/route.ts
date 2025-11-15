import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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

    // Insert data into Supabase
    const { data, error } = await supabase
      .from('biometrics')
      .insert([
        {
          date: body.date,
          metric_type: body.metric_type,
          value: body.value,
          unit: body.unit,
          notes: body.notes || null,
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save biometric data', details: error.message },
        { status: 500 }
      );
    }

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
    const { data, error } = await supabase
      .from('biometrics')
      .select('*')
      .order('date', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch biometric data', details: error.message },
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
