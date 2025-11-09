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
