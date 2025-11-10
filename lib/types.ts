// Type definitions for biometric data

export interface BiometricEntry {
  id?: string;
  created_at?: string;
  date: string; // ISO date string (YYYY-MM-DD)
  metric_type: string;
  value: number;
  unit: string;
  notes?: string;
}

export type BiometricMetricType = 'weight' | 'waistline';

export interface WeightEntry extends Omit<BiometricEntry, 'metric_type' | 'unit'> {
  metric_type: 'weight';
  unit: 'kg' | 'lbs';
}

// Type definitions for activity data

export interface ActivityEntry {
  id?: string;
  created_at?: string;
  date: string; // ISO date string (YYYY-MM-DD)
  activity_name: string;
  activity_type: 'strength' | 'cardio';
  effort_level: number; // 1-10 scale
  duration_minutes?: number;
  notes?: string;
}

// Type definitions for user profile data

export interface UserProfile {
  id?: string;
  created_at?: string;
  updated_at?: string;
  height?: number;
  height_unit?: 'cm' | 'inches' | 'feet';
  age?: number;
  notes?: string;
}

// Type definitions for stress data

export interface StressEntry {
  id?: string;
  created_at?: string;
  date: string; // ISO date string (YYYY-MM-DD)
  stress_level: number; // 1-10 scale (1=very low, 10=very high)
  notes?: string;
}
