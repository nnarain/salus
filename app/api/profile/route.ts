import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profile')
      .select('*')
      .limit(1)
      .single();

    let result;
    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabase
        .from('user_profile')
        .update({
          height: body.height || null,
          height_unit: body.height_unit || null,
          age: body.age || null,
          notes: body.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json(
          { error: 'Failed to update profile', details: error.message },
          { status: 500 }
        );
      }
      result = data;
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('user_profile')
        .insert([
          {
            height: body.height || null,
            height_unit: body.height_unit || null,
            age: body.age || null,
            notes: body.notes || null,
          },
        ])
        .select();

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json(
          { error: 'Failed to create profile', details: error.message },
          { status: 500 }
        );
      }
      result = data;
    }

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
    const { data, error } = await supabase
      .from('user_profile')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is acceptable
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || null }, { status: 200 });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
