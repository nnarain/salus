"use client";

import { memo, useMemo } from 'react';
import type { StressEntry } from '@/lib/types';
import { aggregateDailyStress, aggregateMonthlyStress, aggregateWeeklyStress } from '@/lib/stressSummary';
import type { WeeklyStressSummary } from '@/lib/stressSummary';
import { getChartRangeLabel, getChartRangeStart } from '@/lib/chartRange';

interface WeeklyStressChartProps {
  entries: StressEntry[] | null;
  rangeYears: number | 'all';
  loading: boolean;
}

const STRESS_COLORS = {
  low: '#22c55e',
  moderate: '#fbbf24',
  high: '#ef4444',
};

function getStressColor(averageStress?: number): string | undefined {
  if (averageStress === undefined) return undefined;
  if (averageStress <= 3) return STRESS_COLORS.low;
  if (averageStress <= 7) return STRESS_COLORS.moderate;
  return STRESS_COLORS.high;
}

const SAMPLE_STRESS_BASELINES = [2, 4, 8, 5, 9, 3, 6, 8, 2, 7, 4, 9];

function createSampleEntries(rangeYears: number | 'all'): StressEntry[] {
  const weekCount = rangeYears === 'all' ? 260 : Math.ceil(rangeYears * 52);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [year, month, day] = today.split('-').map(Number);
  const currentWeek = new Date(Date.UTC(year, month - 1, day));
  currentWeek.setUTCDate(currentWeek.getUTCDate() - ((currentWeek.getUTCDay() + 6) % 7));

  return Array.from({ length: weekCount }, (_, weekIndex) => {
    const week = new Date(currentWeek);
    week.setUTCDate(week.getUTCDate() - (weekCount - weekIndex - 1) * 7);
    const baseline = SAMPLE_STRESS_BASELINES[Math.floor(weekIndex / 4) % SAMPLE_STRESS_BASELINES.length];

    return Array.from({ length: 5 }, (_, dayOffset) => {
      const date = new Date(week);
      date.setUTCDate(date.getUTCDate() + dayOffset);
      const variation = ((weekIndex * 7 + dayOffset * 3) % 5) - 2;
      return {
        date: date.toISOString().slice(0, 10),
        stress_level: Math.max(1, Math.min(10, baseline + variation)),
      };
    });
  }).flat();
}

function fillMissingWeeks(summaries: WeeklyStressSummary[]): WeeklyStressSummary[] {
  if (summaries.length === 0) return summaries;

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [year, month, day] = today.split('-').map(Number);
  const lastWeek = new Date(Date.UTC(year, month - 1, day));
  lastWeek.setUTCDate(lastWeek.getUTCDate() - ((lastWeek.getUTCDay() + 6) % 7));
  const summaryByWeek = new Map(summaries.map((summary) => [summary.weekStart, summary]));
  const week = new Date(`${summaries[0].weekStart}T00:00:00Z`);
  const completeSummaries: WeeklyStressSummary[] = [];

  while (week <= lastWeek) {
    const weekStart = week.toISOString().slice(0, 10);
    completeSummaries.push(summaryByWeek.get(weekStart) ?? {
      weekStart,
      low: 0,
      moderate: 0,
      high: 0,
      readingCount: 0,
      averageStress: undefined,
    });
    week.setUTCDate(week.getUTCDate() + 7);
  }

  return completeSummaries;
}

function getMonthStartForWeek(weekStart: string): string {
  const thursday = new Date(`${weekStart}T00:00:00Z`);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  return `${thursday.toISOString().slice(0, 7)}-01`;
}

function formatCalendarDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function WeeklyStressChart({ entries, rangeYears, loading }: WeeklyStressChartProps) {
  const { chartData, calendarWeeks, monthlyData } = useMemo(() => {
    if (!entries) return { chartData: [], calendarWeeks: [], monthlyData: [] };

    const sourceEntries = entries.length === 0 ? createSampleEntries(rangeYears) : entries;
    const cutoffDate = rangeYears === 'all' ? new Date() : getChartRangeStart(rangeYears);
    const rangedEntries = rangeYears === 'all'
      ? sourceEntries
      : sourceEntries.filter((entry) => new Date(`${entry.date}T00:00:00`) >= cutoffDate);

    const weeklySummaries = fillMissingWeeks(aggregateWeeklyStress(rangedEntries));
    const dailyByDate = new Map(aggregateDailyStress(rangedEntries).map((summary) => [summary.date, summary]));
    const weekdays = weeklySummaries.map((week) => {
      const monday = new Date(`${week.weekStart}T00:00:00Z`);
      const days = Array.from({ length: 5 }, (_, dayOffset) => {
        const date = new Date(monday);
        date.setUTCDate(date.getUTCDate() + dayOffset);
        const dateKey = date.toISOString().slice(0, 10);
        return { date: dateKey, summary: dailyByDate.get(dateKey) };
      });
      return { weekStart: week.weekStart, days };
    });

    return {
      chartData: weeklySummaries,
      calendarWeeks: weekdays,
      monthlyData: aggregateMonthlyStress(weeklySummaries),
    };
  }, [entries, rangeYears]);

  if (loading) {
    return (
      <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Weekly Stress</h2>
        <p className="text-gray-600 dark:text-gray-400">Loading stress data...</p>
      </section>
    );
  }

  if (entries === null) {
    return (
      <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Weekly Stress</h2>
        <p className="text-gray-600 dark:text-gray-400">Stress data is unavailable.</p>
      </section>
    );
  }

  const hasSampleData = entries.length === 0;

  return (
    <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Stress patterns</h2>
        <div className="flex items-center gap-3">
          {hasSampleData && (
            <span className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Sample preview</span>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {getChartRangeLabel(rangeYears)}
          </span>
        </div>
      </div>
      <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">
        Daily weekday cells show each day&apos;s average; monthly colors smooth together recorded weekly averages.
        {hasSampleData && ' Example values only; they are not saved.'}
      </p>

      {chartData.length === 0 ? (
        <div className="py-12 text-center text-gray-600 dark:text-gray-400">
          No stress readings in this date range.
        </div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <div style={{ width: `max(100%, ${chartData.length * 13 + 76}px)` }}>
            <div className="mb-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Monthly pattern</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">Average of recorded weekly averages</span>
              </div>
              <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-300">
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: STRESS_COLORS.low }} />Low (1–3)</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: STRESS_COLORS.moderate }} />Moderate (4–7)</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: STRESS_COLORS.high }} />High (8–10)</span>
              </div>
              <div className="flex">
                <div className="w-16 shrink-0" />
                <div
                  className="grid min-w-0 flex-1 gap-1"
                  style={{
                    gridTemplateColumns: monthlyData.map((month) => `${month.weeksInRange}fr`).join(' '),
                  }}
                >
                  {monthlyData.map((month) => {
                    const averageStress = month.averageStress;
                    const monthLabel = new Date(`${month.monthStart}T12:00:00`).toLocaleDateString(undefined, {
                      month: 'long',
                      year: 'numeric',
                    });
                    const description = averageStress === undefined
                      ? `${monthLabel}: no readings across ${month.weeksInRange} weeks`
                      : `${monthLabel}: average ${averageStress} of 10 across ${month.weeksWithReadings} of ${month.weeksInRange} weeks and ${month.readingCount} readings`;

                    return (
                      <div key={month.monthStart} className="min-w-0">
                        <div
                          role="img"
                          aria-label={description}
                          title={description}
                          className={`h-3 rounded-sm ${averageStress === undefined ? 'bg-gray-200 dark:bg-gray-700/70' : ''}`}
                          style={averageStress === undefined ? undefined : { backgroundColor: getStressColor(averageStress) }}
                        />
                        <span className="mt-1 block truncate text-[10px] text-gray-500 dark:text-gray-400">
                          {new Date(`${month.monthStart}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Daily stress · weekdays</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">Blank cells mean no reading</span>
              </div>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                One cell per weekday. Weekend readings are included in the monthly summary.
              </p>
              <div className="flex">
                <div className="grid w-16 shrink-0 grid-rows-5 gap-[3px] pt-5 text-[10px] text-gray-500 dark:text-gray-400">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="mb-1 grid text-[10px] text-gray-500 dark:text-gray-400"
                    style={{ gridTemplateColumns: `repeat(${calendarWeeks.length}, minmax(0, 1fr))` }}
                  >
                    {calendarWeeks.map((week, index) => {
                      const monthStart = getMonthStartForWeek(week.weekStart);
                      const previousMonth = index > 0
                        ? getMonthStartForWeek(calendarWeeks[index - 1].weekStart)
                        : null;
                      return (
                        <span key={week.weekStart} className="whitespace-nowrap">
                          {index === 0 || monthStart !== previousMonth
                            ? new Date(`${monthStart}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })
                            : ''}
                        </span>
                      );
                    })}
                  </div>
                  <div
                    className="grid grid-flow-col grid-rows-5 gap-[3px]"
                    style={{ gridTemplateColumns: `repeat(${calendarWeeks.length}, minmax(0, 1fr))` }}
                  >
                    {calendarWeeks.flatMap((week) => week.days.map((day) => {
                      const averageStress = day.summary?.averageStress;
                      const fill = getStressColor(averageStress);
                      const description = averageStress === undefined
                        ? `${formatCalendarDate(day.date)}: no reading`
                        : `${formatCalendarDate(day.date)}: average ${averageStress} of 10 across ${day.summary?.readingCount} ${day.summary?.readingCount === 1 ? 'reading' : 'readings'}`;

                      return (
                        <span
                          key={day.date}
                          role="img"
                          aria-label={description}
                          title={description}
                          className={`h-[10px] w-[10px] justify-self-center rounded-[2px] ${
                            averageStress === undefined ? 'bg-gray-200 dark:bg-gray-700/70' : ''
                          }`}
                          style={fill ? { backgroundColor: fill } : undefined}
                        />
                      );
                    }))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </section>
  );
}

export default memo(WeeklyStressChart);