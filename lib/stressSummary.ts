import type { StressEntry } from '@/lib/types';

export interface WeeklyStressSummary {
  weekStart: string;
  low: number;
  moderate: number;
  high: number;
  readingCount: number;
  averageStress?: number;
}

export interface DailyStressSummary {
  date: string;
  readingCount: number;
  averageStress: number;
}

export interface MonthlyStressSummary {
  monthStart: string;
  averageStress?: number;
  weeksWithReadings: number;
  weeksInRange: number;
  readingCount: number;
}

export function aggregateDailyStress(entries: StressEntry[]): DailyStressSummary[] {
  const days = new Map<string, { total: number; readingCount: number }>();

  entries.forEach((entry) => {
    const date = entry.date.slice(0, 10);
    const day = days.get(date) ?? { total: 0, readingCount: 0 };
    day.total += entry.stress_level;
    day.readingCount++;
    days.set(date, day);
  });

  return Array.from(days.entries())
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([date, day]) => ({
      date,
      readingCount: day.readingCount,
      averageStress: Number((day.total / day.readingCount).toFixed(1)),
    }));
}

export function aggregateWeeklyStress(entries: StressEntry[]): WeeklyStressSummary[] {
  const weeks = new Map<string, { low: number; moderate: number; high: number; total: number }>();

  entries.forEach((entry) => {
    const [year, month, day] = entry.date.slice(0, 10).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const weekStart = date.toISOString().slice(0, 10);
    const week = weeks.get(weekStart) ?? { low: 0, moderate: 0, high: 0, total: 0 };

    if (entry.stress_level <= 3) week.low++;
    else if (entry.stress_level <= 7) week.moderate++;
    else week.high++;
    week.total += entry.stress_level;
    weeks.set(weekStart, week);
  });

  return Array.from(weeks.entries())
    .sort(([firstWeek], [secondWeek]) => firstWeek.localeCompare(secondWeek))
    .map(([weekStart, week]) => {
      const readingCount = week.low + week.moderate + week.high;
      return {
        weekStart,
        low: week.low,
        moderate: week.moderate,
        high: week.high,
        readingCount,
        averageStress: Number((week.total / readingCount).toFixed(1)),
      };
    });
}

export function aggregateMonthlyStress(weeks: WeeklyStressSummary[]): MonthlyStressSummary[] {
  const months = new Map<string, {
    totalWeeklyAverage: number;
    weeksWithReadings: number;
    weeksInRange: number;
    readingCount: number;
  }>();

  weeks.forEach((week) => {
    const thursday = new Date(`${week.weekStart}T00:00:00Z`);
    thursday.setUTCDate(thursday.getUTCDate() + 3);
    const monthStart = `${thursday.toISOString().slice(0, 7)}-01`;
    const month = months.get(monthStart) ?? {
      totalWeeklyAverage: 0,
      weeksWithReadings: 0,
      weeksInRange: 0,
      readingCount: 0,
    };

    month.weeksInRange++;
    month.readingCount += week.readingCount;
    if (week.averageStress !== undefined) {
      month.totalWeeklyAverage += week.averageStress;
      month.weeksWithReadings++;
    }
    months.set(monthStart, month);
  });

  return Array.from(months.entries())
    .sort(([firstMonth], [secondMonth]) => firstMonth.localeCompare(secondMonth))
    .map(([monthStart, month]) => ({
      monthStart,
      averageStress: month.weeksWithReadings > 0
        ? Number((month.totalWeeklyAverage / month.weeksWithReadings).toFixed(1))
        : undefined,
      weeksWithReadings: month.weeksWithReadings,
      weeksInRange: month.weeksInRange,
      readingCount: month.readingCount,
    }));
}