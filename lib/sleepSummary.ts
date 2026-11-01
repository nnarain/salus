import type { SleepEntry } from '@/lib/types';

export interface SleepTargetBand {
  minimumHours: number;
  maximumHours: number;
}

export interface DailySleepSummary {
  wakeDate: string;
  sleepHours: number;
  entryCount: number;
}

export function getSleepTargetBand(age?: number): SleepTargetBand | null {
  if (age !== undefined && age < 18) return null;
  if (age !== undefined && age >= 65) return { minimumHours: 7, maximumHours: 8 };
  return { minimumHours: 7, maximumHours: 9 };
}

export function aggregateDailySleep(entries: SleepEntry[]): DailySleepSummary[] {
  const days = new Map<string, { totalMinutes: number; entryCount: number }>();

  entries.forEach((entry) => {
    const wakeDate = entry.wake_date.slice(0, 10);
    const day = days.get(wakeDate) ?? { totalMinutes: 0, entryCount: 0 };
    day.totalMinutes += entry.sleep_duration_minutes;
    day.entryCount++;
    days.set(wakeDate, day);
  });

  return Array.from(days.entries())
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([wakeDate, day]) => ({
      wakeDate,
      sleepHours: Number((day.totalMinutes / day.entryCount / 60).toFixed(2)),
      entryCount: day.entryCount,
    }));
}