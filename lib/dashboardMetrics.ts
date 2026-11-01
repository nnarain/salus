import type { BiometricEntry, NutritionEntry } from '@/lib/types';
import { poundsToKilograms } from '@/lib/weight';

export interface SevenDayCalorieSummary {
  averageIntakeKcal?: number;
  daysLogged: number;
  windowDays: 7;
}

export interface SevenDayWeightTrend {
  currentAverageKg?: number;
  previousAverageKg?: number;
  differenceKg?: number;
  currentDaysLogged: number;
  previousDaysLogged: number;
}

export type SummaryTone = 'green' | 'blue' | 'yellow' | 'red';

export function getCalorieBalanceTone(estimatedBalanceKcal: number | null): SummaryTone {
  if (estimatedBalanceKcal === null) return 'blue';
  if (estimatedBalanceKcal >= 100 && estimatedBalanceKcal <= 500) return 'green';
  if (estimatedBalanceKcal > 500) return 'yellow';
  if (estimatedBalanceKcal >= -100) return 'blue';
  if (estimatedBalanceKcal >= -300) return 'yellow';
  return 'red';
}

export function getWeightTrendTone(weightChangeKg: number | undefined, normalizedRisk: number | null): SummaryTone {
  if (weightChangeKg === undefined || weightChangeKg === 0 || normalizedRisk === null) return 'blue';
  if (normalizedRisk < 0.33) return weightChangeKg > 0 ? 'green' : 'yellow';
  return weightChangeKg < 0 ? 'green' : 'red';
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateOffset(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return dateKey(result);
}

function utcToday(today: Date): Date {
  return new Date(`${dateKey(today)}T00:00:00Z`);
}

export function getSevenDayCalorieSummary(
  entries: NutritionEntry[],
  today = new Date(),
): SevenDayCalorieSummary {
  const endDate = dateKey(utcToday(today));
  const startDate = dateOffset(utcToday(today), -6);
  const dailyCalories = new Map<string, number>();

  entries.forEach((entry) => {
    if (entry.date >= startDate && entry.date <= endDate) {
      dailyCalories.set(entry.date, entry.calories_kcal);
    }
  });

  const daysLogged = dailyCalories.size;
  const totalCalories = Array.from(dailyCalories.values()).reduce((sum, value) => sum + value, 0);
  return {
    averageIntakeKcal: daysLogged > 0 ? Math.round(totalCalories / daysLogged) : undefined,
    daysLogged,
    windowDays: 7,
  };
}

export function getSevenDayWeightTrend(
  entries: BiometricEntry[],
  today = new Date(),
): SevenDayWeightTrend {
  const endDate = dateKey(utcToday(today));
  const currentStart = dateOffset(utcToday(today), -6);
  const previousStart = dateOffset(utcToday(today), -13);
  const dailyWeights = new Map<string, { totalKg: number; count: number }>();

  entries.forEach((entry) => {
    if (entry.metric_type !== 'weight' || entry.value <= 0) return;
    const date = entry.date.slice(0, 10);
    if (date < previousStart || date > endDate) return;
    const daily = dailyWeights.get(date) ?? { totalKg: 0, count: 0 };
    daily.totalKg += entry.unit === 'lbs' ? poundsToKilograms(entry.value) : entry.value;
    daily.count++;
    dailyWeights.set(date, daily);
  });

  const currentDays = Array.from(dailyWeights.entries())
    .filter(([date]) => date >= currentStart && date <= endDate)
    .map(([, daily]) => daily.totalKg / daily.count);
  const previousDays = Array.from(dailyWeights.entries())
    .filter(([date]) => date >= previousStart && date < currentStart)
    .map(([, daily]) => daily.totalKg / daily.count);
  const currentAverageKg = currentDays.length > 0
    ? currentDays.reduce((sum, value) => sum + value, 0) / currentDays.length
    : undefined;
  const previousAverageKg = previousDays.length > 0
    ? previousDays.reduce((sum, value) => sum + value, 0) / previousDays.length
    : undefined;
  const hasReliableComparison = currentDays.length >= 2 && previousDays.length >= 2;

  return {
    currentAverageKg: currentAverageKg === undefined ? undefined : Number(currentAverageKg.toFixed(2)),
    previousAverageKg: previousAverageKg === undefined ? undefined : Number(previousAverageKg.toFixed(2)),
    differenceKg: hasReliableComparison && currentAverageKg !== undefined && previousAverageKg !== undefined
      ? Number((currentAverageKg - previousAverageKg).toFixed(2))
      : undefined,
    currentDaysLogged: currentDays.length,
    previousDaysLogged: previousDays.length,
  };
}