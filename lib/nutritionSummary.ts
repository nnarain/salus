import type { NutritionEntry } from '@/lib/types';

export interface DailyNutritionTotals {
  date: string;
  calories_kcal: number | null;
  protein_grams: number | null;
  water_ml: number | null;
  estimated: boolean;
  partial: boolean;
}

export function aggregateDailyNutrition(entries: NutritionEntry[]): DailyNutritionTotals[] {
  const days = new Map<string, DailyNutritionTotals>();

  entries.forEach((entry) => {
    const day = days.get(entry.date) ?? {
      date: entry.date,
      calories_kcal: null,
      protein_grams: null,
      water_ml: null,
      estimated: false,
      partial: false,
    };

    if (entry.calories_kcal != null) day.calories_kcal = (day.calories_kcal ?? 0) + entry.calories_kcal;
    if (entry.protein_grams != null) day.protein_grams = (day.protein_grams ?? 0) + entry.protein_grams;
    if (entry.water_ml != null) day.water_ml = (day.water_ml ?? 0) + entry.water_ml;
    day.estimated ||= entry.estimated === true;
    day.partial ||= entry.partial === true;
    days.set(entry.date, day);
  });

  return Array.from(days.values()).sort((first, second) => first.date.localeCompare(second.date));
}