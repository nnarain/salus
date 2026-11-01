import type { ActivityEntry } from '@/lib/types';

export interface WeeklyActivitySummary {
  weekStart: string;
  totalHours: number;
  weightedEffort?: number;
  sessionCount: number;
  sessionsWithoutDuration: number;
}

export function getWeekStart(date: string): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const weekDate = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (weekDate.getUTCDay() + 6) % 7;
  weekDate.setUTCDate(weekDate.getUTCDate() - daysSinceMonday);
  return weekDate.toISOString().slice(0, 10);
}

export function aggregateWeeklyActivities(activities: ActivityEntry[]): WeeklyActivitySummary[] {
  const weeks = new Map<string, {
    totalMinutes: number;
    weightedEffortTotal: number;
    sessionCount: number;
    sessionsWithoutDuration: number;
  }>();

  activities.forEach((activity) => {
    const weekStart = getWeekStart(activity.date);
    const week = weeks.get(weekStart) ?? {
      totalMinutes: 0,
      weightedEffortTotal: 0,
      sessionCount: 0,
      sessionsWithoutDuration: 0,
    };
    week.sessionCount++;

    if (activity.duration_minutes && activity.duration_minutes > 0) {
      week.totalMinutes += activity.duration_minutes;
      week.weightedEffortTotal += activity.effort_level * activity.duration_minutes;
    } else {
      week.sessionsWithoutDuration++;
    }

    weeks.set(weekStart, week);
  });

  return Array.from(weeks.entries())
    .sort(([firstWeek], [secondWeek]) => firstWeek.localeCompare(secondWeek))
    .map(([weekStart, week]) => ({
      weekStart,
      totalHours: Number((week.totalMinutes / 60).toFixed(1)),
      weightedEffort: week.totalMinutes > 0
        ? Number((week.weightedEffortTotal / week.totalMinutes).toFixed(1))
        : undefined,
      sessionCount: week.sessionCount,
      sessionsWithoutDuration: week.sessionsWithoutDuration,
    }));
}