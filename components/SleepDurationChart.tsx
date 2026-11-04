"use client";

import { memo, useMemo } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SleepEntry } from '@/lib/types';
import { aggregateDailySleep, getSleepTargetBand } from '@/lib/sleepSummary';
import type { SleepTargetBand } from '@/lib/sleepSummary';
import { getChartRangeLabel, getChartRangeStart } from '@/lib/chartRange';

interface SleepDurationChartProps {
  entries: SleepEntry[] | null;
  rangeYears: number | 'all';
  age?: number;
  loading: boolean;
}

interface SleepChartPoint {
  date: string;
  sleepHours?: number;
  sevenDayAverage?: number;
}

interface SleepTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: SleepChartPoint }>;
  targetBand: SleepTargetBand | null;
}

const SLEEP_COLORS = {
  below: '#f59e0b',
  within: '#22c55e',
  above: '#94a3b8',
};

function dateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function createSampleEntries(rangeYears: number | 'all'): SleepEntry[] {
  const dayCount = rangeYears === 'all' ? 730 : Math.ceil(rangeYears * 365);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const durationPattern = [420, 465, 390, 510, 435, 555, 405, 480, 450, 375, 495, 435, 525, 400];

  return Array.from({ length: dayCount }, (_, index) => {
    const wakeDate = new Date(today);
    wakeDate.setDate(wakeDate.getDate() - (dayCount - index - 1));
    const variation = ((index * 7) % 35) - 17;
    const sleepDuration = Math.max(300, Math.min(600, durationPattern[index % durationPattern.length] + variation));
    return {
      wake_date: dateToString(wakeDate),
      bedtime: '23:00',
      wake_time: '07:00',
      sleep_duration_minutes: sleepDuration,
    };
  });
}

function getDailySleepColor(hours: number, targetBand: SleepTargetBand | null): string {
  if (!targetBand) return SLEEP_COLORS.above;
  if (hours < targetBand.minimumHours) return SLEEP_COLORS.below;
  if (hours <= targetBand.maximumHours) return SLEEP_COLORS.within;
  return SLEEP_COLORS.above;
}

function SleepDurationDot({
  cx,
  cy,
  payload,
  targetBand,
}: {
  cx?: number;
  cy?: number;
  payload?: SleepChartPoint;
  targetBand: SleepTargetBand | null;
}) {
  if (cx === undefined || cy === undefined || payload?.sleepHours === undefined) return null;
  return <circle cx={cx} cy={cy} r={2.25} fill={getDailySleepColor(payload.sleepHours, targetBand)} />;
}

function SleepDurationTooltip({ active, payload, targetBand }: SleepTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (point.sleepHours === undefined && point.sevenDayAverage === undefined) return null;

  return (
    <div className="rounded-lg border border-gray-200/60 bg-white/70 p-3 text-sm shadow-lg backdrop-blur-sm dark:border-gray-600/60 dark:bg-gray-800/70">
      <p className="mb-2 font-semibold text-gray-900 dark:text-white">{formatDate(point.date)}</p>
      {point.sleepHours !== undefined && (
        <p style={{ color: getDailySleepColor(point.sleepHours, targetBand) }}>
          Nightly sleep: {(Math.round(point.sleepHours * 10) / 10).toFixed(1)} h
        </p>
      )}
      {point.sevenDayAverage !== undefined && (
        <p className="text-gray-600 dark:text-gray-300">7-day average: {point.sevenDayAverage.toFixed(1)} h</p>
      )}
      {targetBand && (
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Guide: {targetBand.minimumHours}–{targetBand.maximumHours} h
        </p>
      )}
    </div>
  );
}

function SleepDurationChart({ entries, rangeYears, age, loading }: SleepDurationChartProps) {
  const targetBand = getSleepTargetBand(age);
  const { chartData, hasSampleData, startDate, endDate } = useMemo(() => {
    if (!entries) return { chartData: [], hasSampleData: false, startDate: '', endDate: '' };

    const hasSampleData = entries.length === 0;
    const sourceEntries = hasSampleData ? createSampleEntries(rangeYears) : entries;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = new Date(today);

    if (rangeYears === 'all') {
      const earliestDate = sourceEntries.reduce<string | null>((earliest, entry) => {
        return earliest === null || entry.wake_date < earliest ? entry.wake_date : earliest;
      }, null);
      start = earliestDate ? new Date(`${earliestDate}T00:00:00`) : new Date(today.getTime() - 729 * 86400000);
    } else {
      start = getChartRangeStart(rangeYears, today);
    }

    const startDate = dateToString(start);
    const endDate = dateToString(today);
    const rangedEntries = sourceEntries.filter((entry) => entry.wake_date >= startDate && entry.wake_date <= endDate);
    const nightlyByDate = new Map(aggregateDailySleep(rangedEntries).map((summary) => [summary.wakeDate, summary.sleepHours]));
    const chartData: SleepChartPoint[] = [];

    for (const date = new Date(start); date <= today; date.setDate(date.getDate() + 1)) {
      const currentDate = dateToString(date);
      const sleepHours = nightlyByDate.get(currentDate);
      const weekStart = new Date(date);
      weekStart.setDate(weekStart.getDate() - 6);
      const sevenDayReadings = [];

      for (const previousDate = new Date(weekStart); previousDate <= date; previousDate.setDate(previousDate.getDate() + 1)) {
        const value = nightlyByDate.get(dateToString(previousDate));
        if (value !== undefined) sevenDayReadings.push(value);
      }

      chartData.push({
        date: currentDate,
        sleepHours,
        sevenDayAverage: sevenDayReadings.length >= 4
          ? Number((sevenDayReadings.reduce((total, value) => total + value, 0) / sevenDayReadings.length).toFixed(2))
          : undefined,
      });
    }

    return { chartData, hasSampleData, startDate, endDate };
  }, [entries, rangeYears]);

  if (loading) {
    return (
      <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Sleep duration</h2>
        <p className="text-gray-600 dark:text-gray-400">Loading sleep data...</p>
      </section>
    );
  }

  if (entries === null) {
    return (
      <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Sleep duration</h2>
        <p className="text-gray-600 dark:text-gray-400">Sleep data is unavailable.</p>
      </section>
    );
  }

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sleep duration</h2>
        <div className="flex items-center gap-3">
          {hasSampleData && (
            <span className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Sample preview</span>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {getChartRangeLabel(rangeYears)}
          </span>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Nightly duration and 7-day average. Longer sleep is not automatically worse.
          {hasSampleData && ' Example values only; they are not saved.'}
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
          {targetBand ? (
            <>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Below {targetBand.minimumHours} h</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />{targetBand.minimumHours}–{targetBand.maximumHours} h target</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Above {targetBand.maximumHours} h</span>
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              Adult target band is not applied for ages under 18.
            </span>
          )}
          <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-teal-400" />7-day average</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
            tick={{ fontSize: 11 }}
            interval={tickInterval}
            minTickGap={32}
          />
          <YAxis
            domain={[0, 12]}
            ticks={[0, 3, 6, 9, 12]}
            tickFormatter={(value: number) => `${value} h`}
            label={{ value: 'Hours asleep', angle: -90, position: 'insideLeft' }}
          />
          {targetBand && (
            <ReferenceArea
              y1={targetBand.minimumHours}
              y2={targetBand.maximumHours}
              fill="rgba(34, 197, 94, 0.12)"
              stroke="rgba(34, 197, 94, 0.35)"
            />
          )}
          <Tooltip content={<SleepDurationTooltip targetBand={targetBand} />} />
          <Line
            type="monotone"
            dataKey="sleepHours"
            name="Nightly sleep"
            stroke="transparent"
            strokeWidth={0}
            connectNulls={false}
            dot={({ key, ...dotProps }) => (
              <SleepDurationDot key={key} {...dotProps} targetBand={targetBand} />
            )}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="sevenDayAverage"
            name="7-day average"
            stroke="#0891b2"
            strokeWidth={2.75}
            strokeDasharray="6 3"
            connectNulls={false}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {targetBand
          ? age === undefined
            ? `Adult guide shown by default: ${targetBand.minimumHours}–${targetBand.maximumHours} hours. Add your age in User Settings for an age-specific band.`
            : `Guide shown for age ${age}: ${targetBand.minimumHours}–${targetBand.maximumHours} hours.`
          : `Showing ${startDate} through ${endDate}; the target band is not set for this age.`}
      </p>
    </section>
  );
}

export default memo(SleepDurationChart);