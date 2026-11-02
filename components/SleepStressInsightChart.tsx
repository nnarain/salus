"use client";

import { useMemo } from 'react';
import {
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SleepEntry, StressEntry } from '@/lib/types';
import { pairSleepWithPriorDayStress } from '@/lib/insights';
import type { SleepStressPair } from '@/lib/insights';
import { getSleepTargetBand } from '@/lib/sleepSummary';

interface SleepStressInsightChartProps {
  sleepEntries: SleepEntry[] | null;
  stressEntries: StressEntry[] | null;
  rangeYears: number | 'all';
  age?: number;
}

interface SleepStressTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: SleepStressPair }>;
}

const STRESS_COLORS = {
  low: '#22c55e',
  moderate: '#fbbf24',
  high: '#ef4444',
};

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SleepStressTooltip({ active, payload }: SleepStressTooltipProps) {
  if (!active || !payload?.length) return null;
  const pair = payload[0].payload;

  return (
    <div className="rounded-lg border border-gray-200/60 bg-white/70 p-3 text-sm shadow-lg backdrop-blur-sm dark:border-gray-600/60 dark:bg-gray-800/70">
      <p className="mb-2 font-semibold text-gray-900 dark:text-white">Sleep ending {formatDate(pair.wakeDate)}</p>
      <p className="text-gray-700 dark:text-gray-300">Prior-day stress ({formatDate(pair.stressDate)}): {pair.stressLevel} / 10</p>
      <p className="text-gray-700 dark:text-gray-300">Sleep duration: {pair.sleepHours.toFixed(1)} h</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {pair.stressReadings} stress {pair.stressReadings === 1 ? 'reading' : 'readings'} · {pair.sleepReadings} sleep {pair.sleepReadings === 1 ? 'entry' : 'entries'}
      </p>
    </div>
  );
}

function filterRange<T extends { wakeDate: string }>(
  entries: T[],
  rangeYears: number | 'all',
): T[] {
  if (rangeYears === 'all') return entries;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - rangeYears);
  const cutoffDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  return entries.filter((entry) => entry.wakeDate >= cutoffDate);
}

export default function SleepStressInsightChart({
  sleepEntries,
  stressEntries,
  rangeYears,
  age,
}: SleepStressInsightChartProps) {
  const targetBand = getSleepTargetBand(age);
  const pairs = useMemo(() => {
    if (!sleepEntries || !stressEntries) return [];
    return filterRange(pairSleepWithPriorDayStress(sleepEntries, stressEntries), rangeYears);
  }, [sleepEntries, stressEntries, rangeYears]);

  const lowStressPairs = pairs.filter((pair) => pair.stressLevel <= 3);
  const moderateStressPairs = pairs.filter((pair) => pair.stressLevel >= 4 && pair.stressLevel <= 7);
  const highStressPairs = pairs.filter((pair) => pair.stressLevel >= 8);

  return (
    <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sleep &amp; stress relationship</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">{pairs.length} paired {pairs.length === 1 ? 'day' : 'days'}</span>
      </div>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Prior-day stress versus sleep duration the following morning. This shows an observed association, not causation.
      </p>

      {pairs.length === 0 ? (
        <div className="flex h-[360px] items-center justify-center rounded-md border border-gray-200 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          No overlapping sleep and stress entries in this date range.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 12, right: 20, bottom: 24, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="stressLevel"
              name="Stress"
              domain={[1, 10]}
              ticks={[1, 3, 5, 7, 10]}
              label={{ value: 'Prior-day stress (1–10)', position: 'insideBottom', offset: -14 }}
            />
            <YAxis
              type="number"
              dataKey="sleepHours"
              name="Sleep duration"
              domain={[0, 12]}
              ticks={[0, 3, 6, 9, 12]}
              tickFormatter={(value: number) => `${value} h`}
              label={{ value: 'Sleep duration', angle: -90, position: 'insideLeft' }}
            />
            {targetBand && (
              <ReferenceArea
                y1={targetBand.minimumHours}
                y2={targetBand.maximumHours}
                fill="rgba(34, 197, 94, 0.1)"
                stroke="rgba(34, 197, 94, 0.3)"
              />
            )}
            <Tooltip content={<SleepStressTooltip />} />
            <Scatter name="Low stress (1–3)" data={lowStressPairs} fill={STRESS_COLORS.low} />
            <Scatter name="Moderate stress (4–7)" data={moderateStressPairs} fill={STRESS_COLORS.moderate} />
            <Scatter name="High stress (8–10)" data={highStressPairs} fill={STRESS_COLORS.high} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
      {pairs.length > 0 && pairs.length < 8 && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          More paired days are needed before a trend is likely to be informative.
        </p>
      )}
    </section>
  );
}