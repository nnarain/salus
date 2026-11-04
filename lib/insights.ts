import type { BiometricEntry, NutritionEntry, SleepEntry, StressEntry, UserProfile } from '@/lib/types';
import { estimateMaintenanceForWeightKg } from '@/lib/calorieEstimate';
import { aggregateDailySleep } from '@/lib/sleepSummary';
import { aggregateDailyStress } from '@/lib/stressSummary';
import { aggregateDailyNutrition } from '@/lib/nutritionSummary';
import { poundsToKilograms } from '@/lib/weight';

export interface SleepStressPair {
  stressDate: string;
  wakeDate: string;
  stressLevel: number;
  sleepHours: number;
  stressReadings: number;
  sleepReadings: number;
}

export interface DailyCalorieBalancePoint {
  date: string;
  intakeKcal: number;
  estimatedMaintenanceKcal?: number;
  estimatedBalanceKcal?: number;
  weightDate?: string;
}

function dateToUtcDay(date: string): number {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export interface WeightStressPoint {
  date: string;
  timestamp: number;
  weight?: number;
  stressLevel?: number;
}

export interface StressWindow {
  start: number;
  end: number;
  level: 'moderate' | 'high';
}

export interface LoggingGap {
  start: number;
  end: number;
  days: number;
  metric: 'weight' | 'stress';
  afterHighStress: boolean;
}

export function buildWeightStressTimeline(
  biometrics: BiometricEntry[],
  stressEntries: StressEntry[],
  startDate: string,
  endDate: string,
  unit: 'kg' | 'lbs',
): { points: WeightStressPoint[]; windows: StressWindow[]; gaps: LoggingGap[] } {
  const weights = new Map<string, { totalKg: number; count: number }>();
  biometrics.forEach((entry) => {
    const date = entry.date.slice(0, 10);
    if (entry.metric_type !== 'weight' || !Number.isFinite(entry.value) || entry.value <= 0
      || date > endDate) return;
    const daily = weights.get(date) ?? { totalKg: 0, count: 0 };
    daily.totalKg += entry.unit === 'lbs' ? poundsToKilograms(entry.value) : entry.value;
    daily.count++;
    weights.set(date, daily);
  });
  const stress = new Map(aggregateDailyStress(stressEntries).map((entry) => [entry.date, entry.averageStress]));
  const points: WeightStressPoint[] = [];
  const windows: StressWindow[] = [];
  for (let date = startDate; date <= endDate; date = shiftDate(date, 1)) {
    const timestamp = dateToUtcDay(date);
    const dailyWeight = weights.get(date);
    const weightKg = dailyWeight ? dailyWeight.totalKg / dailyWeight.count : undefined;
    const stressLevel = stress.get(date);
    points.push({
      date,
      timestamp: timestamp + 43200000,
      weight: weightKg === undefined ? undefined : weightKg / (unit === 'lbs' ? 0.45359237 : 1),
      stressLevel,
    });
    if (stressLevel === undefined || stressLevel < 4) continue;
    const level = stressLevel >= 8 ? 'high' : 'moderate';
    const previous = windows[windows.length - 1];
    if (previous?.level === level && previous.end === timestamp) {
      previous.end = timestamp + 86400000;
    } else {
      windows.push({ start: timestamp, end: timestamp + 86400000, level });
    }
  }
  const gaps: LoggingGap[] = [];
  const rangeStart = dateToUtcDay(startDate);
  const rangeEnd = dateToUtcDay(endDate) + 86400000;
  for (const metric of ['weight', 'stress'] as const) {
    const dates = Array.from(metric === 'weight' ? weights.keys() : stress.keys())
      .filter((date) => date <= endDate).sort();
    dates.forEach((date, index) => {
      const start = dateToUtcDay(date) + 86400000;
      const end = dates[index + 1] ? dateToUtcDay(dates[index + 1]) : rangeEnd;
      const days = (end - start) / 86400000;
      if (days < 3 || start >= rangeEnd || end <= rangeStart) return;
      gaps.push({ start, end, days, metric, afterHighStress: (stress.get(date) ?? 0) >= 8 });
    });
  }
  gaps.sort((first, second) => first.start - second.start || first.metric.localeCompare(second.metric));
  return { points, windows, gaps };
}

export function pairSleepWithPriorDayStress(
  sleepEntries: SleepEntry[],
  stressEntries: StressEntry[],
): SleepStressPair[] {
  const stressByDate = new Map(aggregateDailyStress(stressEntries).map((entry) => [entry.date, entry]));
  const sleepByDate = aggregateDailySleep(sleepEntries);

  return sleepByDate.flatMap((sleep) => {
    const stressDate = shiftDate(sleep.wakeDate, -1);
    const stress = stressByDate.get(stressDate);
    if (!stress) return [];

    return [{
      stressDate,
      wakeDate: sleep.wakeDate,
      stressLevel: stress.averageStress,
      sleepHours: sleep.sleepHours,
      stressReadings: stress.readingCount,
      sleepReadings: sleep.entryCount,
    }];
  });
}

export function buildDailyCalorieBalance(
  nutritionEntries: NutritionEntry[],
  biometrics: BiometricEntry[],
  profile: UserProfile,
  today = new Date(),
  maximumWeightAgeDays = 30,
): DailyCalorieBalancePoint[] {
  const endDate = today.toISOString().slice(0, 10);
  const weights = biometrics
    .filter((entry) => entry.metric_type === 'weight' && entry.value > 0)
    .map((entry) => ({
      date: entry.date.slice(0, 10),
      kilograms: entry.unit === 'lbs' ? poundsToKilograms(entry.value) : entry.value,
    }))
    .sort((first, second) => first.date.localeCompare(second.date));
  const nutrition = aggregateDailyNutrition(nutritionEntries)
    .filter((entry) => entry.date <= endDate && entry.calories_kcal !== null
      && !entry.estimated && !entry.partial);

  let weightIndex = -1;
  return nutrition.map((entry) => {
    while (weightIndex + 1 < weights.length && weights[weightIndex + 1].date <= entry.date) {
      weightIndex++;
    }

    const priorWeight = weights[weightIndex];
    if (!priorWeight || (dateToUtcDay(entry.date) - dateToUtcDay(priorWeight.date)) / 86400000 > maximumWeightAgeDays) {
      return { date: entry.date, intakeKcal: entry.calories_kcal! };
    }

    const maintenanceKcal = estimateMaintenanceForWeightKg(profile, priorWeight.kilograms);
    if (maintenanceKcal === null) {
      return { date: entry.date, intakeKcal: entry.calories_kcal!, weightDate: priorWeight.date };
    }

    return {
      date: entry.date,
      intakeKcal: entry.calories_kcal!,
      estimatedMaintenanceKcal: maintenanceKcal,
      estimatedBalanceKcal: maintenanceKcal - entry.calories_kcal!,
      weightDate: priorWeight.date,
    };
  });
}
