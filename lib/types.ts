// Type definitions for biometric data

export interface BiometricEntry {
  id?: string;
  created_at?: string;
  date: string; // ISO date string (YYYY-MM-DD)
  metric_type: string;
  value: number;
  unit: string;
  scale_min?: number;
  scale_max?: number;
  notes?: string;
}

export type BiometricMetricType = 'weight' | 'waistline' | 'body_fat_percentage' | 'visceral_fat_level' | 'muscle_mass';

export interface BodyFatEstimate {
  date: string;
  percentage: number;
  method: 'rfm';
}

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
  biological_sex?: 'male' | 'female';
  activity_level?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  daily_calorie_target?: number;
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

export interface SleepEntry {
  id?: string;
  created_at?: string;
  wake_date: string;
  bedtime: string;
  wake_time: string;
  sleep_duration_minutes: number;
  restedness?: number | null;
  notes?: string;
}

export interface NutritionEntry {
  id?: string;
  created_at?: string;
  date: string;
  calories_kcal?: number | null;
  protein_grams?: number | null;
  water_ml?: number | null;
  estimated?: boolean;
  partial?: boolean;
  notes?: string;
}
