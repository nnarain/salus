"use client";

import { memo, useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ActivityEntry } from '@/lib/types';
import { aggregateWeeklyActivities, getWeekStart } from '@/lib/activitySummary';

interface WeeklyActivityChartProps {
  activities: ActivityEntry[] | null;
  rangeYears: number | 'all';
  loading: boolean;
}

const SAMPLE_SESSIONS: number[][][] = [
  [[0, 50, 5], [3, 45, 6]],
  [[1, 60, 6], [4, 35, 5]],
  [[0, 45, 4], [3, 60, 7], [5, 30, 6]],
  [[1, 75, 7], [4, 55, 8]],
  [[0, 45, 5], [2, 60, 6], [5, 35, 5]],
  [[1, 60, 7], [4, 60, 8]],
  [[0, 40, 4], [3, 50, 5]],
  [[1, 75, 8], [4, 55, 7], [6, 30, 6]],
  [[0, 60, 5], [4, 40, 6]],
  [[1, 90, 7], [4, 60, 6]],
];

function createSampleActivities(): ActivityEntry[] {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentWeek = getWeekStart(today);

  return SAMPLE_SESSIONS.flatMap((sessions, weekIndex) => {
    const weekStart = new Date(`${currentWeek}T00:00:00Z`);
    weekStart.setUTCDate(weekStart.getUTCDate() - (SAMPLE_SESSIONS.length - weekIndex - 1) * 7);

    return sessions.map(([dayOffset, duration, effort], sessionIndex) => {
      const sessionDate = new Date(weekStart);
      sessionDate.setUTCDate(sessionDate.getUTCDate() + dayOffset);
      return {
        date: sessionDate.toISOString().slice(0, 10),
        activity_name: 'Sample activity',
        activity_type: sessionIndex % 2 === 0 ? 'cardio' : 'strength',
        effort_level: effort,
        duration_minutes: duration,
      };
    });
  });
}

function fillMissingWeeks(
  summaries: ReturnType<typeof aggregateWeeklyActivities>,
): ReturnType<typeof aggregateWeeklyActivities> {
  if (summaries.length === 0) return summaries;

  const lastWeek = getWeekStart(new Date().toISOString().slice(0, 10));
  const summaryByWeek = new Map(summaries.map((summary) => [summary.weekStart, summary]));
  const week = new Date(`${summaries[0].weekStart}T00:00:00Z`);
  const lastWeekDate = new Date(`${lastWeek}T00:00:00Z`);
  const completeSummaries = [];

  while (week <= lastWeekDate) {
    const weekStart = week.toISOString().slice(0, 10);
    completeSummaries.push(summaryByWeek.get(weekStart) ?? {
      weekStart,
      totalHours: 0,
      weightedEffort: undefined,
      sessionCount: 0,
      sessionsWithoutDuration: 0,
    });
    week.setUTCDate(week.getUTCDate() + 7);
  }

  return completeSummaries;
}

function formatWeekLabel(weekStart: string): string {
  return new Date(`${weekStart}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function WeeklyActivityChart({ activities, rangeYears, loading }: WeeklyActivityChartProps) {
  const chartData = useMemo(() => {
    if (!activities) return [];

    const sourceActivities = activities.length === 0 ? createSampleActivities() : activities;
    const cutoffDate = new Date();
    if (rangeYears !== 'all') {
      cutoffDate.setFullYear(cutoffDate.getFullYear() - rangeYears);
    }
    const rangedActivities = rangeYears === 'all'
      ? sourceActivities
      : sourceActivities.filter((activity) => new Date(`${activity.date}T00:00:00`) >= cutoffDate);

    return fillMissingWeeks(aggregateWeeklyActivities(rangedActivities));
  }, [activities, rangeYears]);

  if (loading || activities === null) {
    return (
      <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Weekly Activity</h2>
        <p className="text-gray-600 dark:text-gray-400">Loading activity data...</p>
      </section>
    );
  }

  const hasSampleData = activities.length === 0;

  return (
    <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Weekly Activity</h2>
        <div className="flex items-center gap-3">
          {hasSampleData && (
            <span className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Sample preview</span>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {rangeYears === 'all' ? 'All available data' : `Last ${rangeYears} ${rangeYears === 1 ? 'year' : 'years'}`}
          </span>
        </div>
      </div>
      <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">
        Weekly active hours and duration-weighted effort (1–10). Sessions without duration are excluded.
        {hasSampleData && ' Example values only; they are not saved.'}
      </p>

      {chartData.length === 0 ? (
        <div className="py-12 text-center text-gray-600 dark:text-gray-400">
          No activities in this date range.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="weekStart"
              tickFormatter={formatWeekLabel}
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              yAxisId="hours"
              allowDecimals
              tickFormatter={(value: number) => `${value}h`}
              label={{ value: 'Active hours', angle: -90, position: 'insideLeft' }}
            />
            <YAxis
              yAxisId="effort"
              orientation="right"
              domain={[1, 10]}
              ticks={[1, 3, 5, 7, 10]}
              label={{ value: 'Effort (1–10)', angle: 90, position: 'insideRight' }}
            />
            <Tooltip
              labelFormatter={(label) => `Week of ${formatWeekLabel(String(label))}`}
              formatter={(value, name) => {
                if (name === 'Active time') return [`${Number(value).toFixed(1)} h`, name];
                if (name === 'Weighted effort') return [`${Number(value).toFixed(1)} / 10`, name];
                return [value, name];
              }}
            />
            <Legend />
            <Bar yAxisId="hours" dataKey="totalHours" name="Active time" fill="#0f9f8f" />
            <Line
              yAxisId="effort"
              type="monotone"
              dataKey="weightedEffort"
              name="Weighted effort"
              stroke="#f97316"
              strokeWidth={3}
              connectNulls
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export default memo(WeeklyActivityChart);