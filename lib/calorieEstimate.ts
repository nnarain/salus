import type { BiometricEntry, NutritionEntry, UserProfile } from '@/lib/types';
import { poundsToKilograms } from '@/lib/weight';

export type CalorieEstimateSource = 'formula' | 'logged_data';

export interface CalorieEstimate {
  caloriesKcal: number;
  source: CalorieEstimateSource;
  weightDate?: string;
  daysCovered?: number;
  nutritionDays?: number;
  weightReadings?: number;
}

const ACTIVITY_MULTIPLIERS: Record<NonNullable<UserProfile['activity_level']>, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function dateToUtcDay(date: string): number {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function differenceInDays(first: string, last: string): number {
  return Math.round((dateToUtcDay(last) - dateToUtcDay(first)) / 86400000);
}

function heightInCentimeters(profile: UserProfile): number | null {
  if (!profile.height || !profile.height_unit) return null;
  if (profile.height_unit === 'cm') return profile.height;
  if (profile.height_unit === 'inches') return profile.height * 2.54;
  return profile.height * 30.48;
}

function weightInKilograms(entry: BiometricEntry): number {
  return entry.unit === 'lbs' ? poundsToKilograms(entry.value) : entry.value;
}

export function estimateMaintenanceForWeightKg(profile: UserProfile, weightKg: number): number | null {
  const heightCm = heightInCentimeters(profile);
  if (
    profile.age === undefined || profile.age < 18 || !heightCm || weightKg <= 0 ||
    !Number.isFinite(weightKg) || !profile.biological_sex || !profile.activity_level
  ) {
    return null;
  }

  const sexAdjustment = profile.biological_sex === 'male' ? 5 : -161;
  const restingEnergy = 10 * weightKg + 6.25 * heightCm - 5 * profile.age + sexAdjustment;
  const maintenance = Math.round(restingEnergy * ACTIVITY_MULTIPLIERS[profile.activity_level]);
  return Number.isFinite(maintenance) && maintenance > 0 ? maintenance : null;
}

export function estimateMaintenanceFromFormula(
  profile: UserProfile,
  biometrics: BiometricEntry[],
  today = new Date(),
): CalorieEstimate | null {
  const todayDate = today.toISOString().slice(0, 10);
  const latestWeight = biometrics
    .filter((entry) => entry.metric_type === 'weight' && entry.value > 0 && entry.date <= todayDate)
    .sort((first, second) => second.date.localeCompare(first.date))[0];
  if (!latestWeight) return null;

  const weightKg = weightInKilograms(latestWeight);
  const caloriesKcal = estimateMaintenanceForWeightKg(profile, weightKg);
  if (caloriesKcal === null) return null;
  return { caloriesKcal, source: 'formula', weightDate: latestWeight.date };
}

export function estimateMaintenanceFromHistory(
  nutritionEntries: NutritionEntry[],
  biometrics: BiometricEntry[],
  today = new Date(),
): CalorieEstimate | null {
  const todayDate = new Date(today);
  todayDate.setUTCHours(0, 0, 0, 0);
  const endDate = todayDate.toISOString().slice(0, 10);
  const windowStart = new Date(todayDate);
  windowStart.setUTCDate(windowStart.getUTCDate() - 27);
  const earliestWindowDate = windowStart.toISOString().slice(0, 10);

  const nutrition = nutritionEntries.filter((entry) =>
    entry.date >= earliestWindowDate && entry.date <= endDate && entry.calories_kcal >= 0,
  );
  const weights = biometrics
    .filter((entry) => entry.metric_type === 'weight' && entry.value > 0 && entry.date >= earliestWindowDate && entry.date <= endDate)
    .map((entry) => ({ date: entry.date, kilograms: weightInKilograms(entry) }))
    .sort((first, second) => first.date.localeCompare(second.date));

  if (nutrition.length === 0 || weights.length < 4) return null;

  const earliestNutritionDate = nutrition.reduce((earliest, entry) => {
    return entry.date < earliest ? entry.date : earliest;
  }, nutrition[0].date);
  const firstEvidenceDate = earliestNutritionDate > weights[0].date
    ? earliestNutritionDate
    : weights[0].date;
  const daysCovered = differenceInDays(firstEvidenceDate, endDate) + 1;
  const weightSpanDays = differenceInDays(weights[0].date, weights[weights.length - 1].date);
  if (daysCovered < 14 || weightSpanDays < 14 || nutrition.length / daysCovered < 0.7) return null;

  const caloriesPerDay = nutrition.reduce((sum, entry) => sum + entry.calories_kcal, 0) / nutrition.length;
  const xValues = weights.map((entry) => differenceInDays(weights[0].date, entry.date));
  const yValues = weights.map((entry) => entry.kilograms);
  const xMean = xValues.reduce((sum, value) => sum + value, 0) / xValues.length;
  const yMean = yValues.reduce((sum, value) => sum + value, 0) / yValues.length;
  const covariance = xValues.reduce((sum, value, index) => sum + (value - xMean) * (yValues[index] - yMean), 0);
  const variance = xValues.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  if (variance === 0) return null;

  const weightChangeKgPerDay = covariance / variance;
  const caloriesKcal = Math.round(caloriesPerDay - weightChangeKgPerDay * 7700);
  if (!Number.isFinite(caloriesKcal) || caloriesKcal < 500 || caloriesKcal > 8000) return null;

  return {
    caloriesKcal,
    source: 'logged_data',
    daysCovered,
    nutritionDays: nutrition.length,
    weightReadings: weights.length,
  };
}

export function getMaintenanceEstimate(
  profile: UserProfile,
  nutritionEntries: NutritionEntry[],
  biometrics: BiometricEntry[],
  today = new Date(),
): CalorieEstimate | null {
  return estimateMaintenanceFromHistory(nutritionEntries, biometrics, today)
    ?? estimateMaintenanceFromFormula(profile, biometrics, today);
}