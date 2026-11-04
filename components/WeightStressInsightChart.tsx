"use client";

import { useId, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { BiometricEntry, StressEntry } from '@/lib/types';
import { buildWeightStressTimeline } from '@/lib/insights';
import type { LoggingGap, WeightStressPoint } from '@/lib/insights';

interface WeightStressInsightChartProps {
  biometrics: BiometricEntry[];
  stressEntries: StressEntry[] | null;
  rangeYears: number | 'all';
  weightDisplayUnit: 'kg' | 'lbs';
  loading: boolean;
}

function formatDate(timestamp: number, includeYear: boolean): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: includeYear ? '2-digit' : undefined, timeZone: 'UTC',
  });
}

function WeightStressTooltip({ active, payload, unit, gaps }: {
  active?: boolean;
  payload?: Array<{ payload: WeightStressPoint }>;
  unit: 'kg' | 'lbs';
  gaps: LoggingGap[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const activeGaps = gaps.filter((gap) => point.timestamp >= gap.start && point.timestamp < gap.end);
  return (
    <div className="max-w-[260px] rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800">
      <p className="mb-2 font-semibold text-gray-900 dark:text-white">{point.date}</p>
      <p className="text-gray-700 dark:text-gray-300">
        {point.weight === undefined ? 'No weigh-in' : `Weight: ${point.weight.toFixed(1)} ${unit}`}
      </p>
      <p className="text-gray-700 dark:text-gray-300">
        {point.stressLevel === undefined ? 'Stress not logged' : `Daily average stress: ${point.stressLevel} / 10`}
      </p>
      {activeGaps.map((gap) => (
        <p key={gap.metric} className="mt-2 border-t border-gray-200 pt-2 text-gray-700 dark:border-gray-600 dark:text-gray-300">
          {gap.days}-day {gap.metric === 'weight' ? 'weigh-in' : 'stress logging'} break
          {gap.afterHighStress && <span className="block font-medium">Immediately after high stress</span>}
        </p>
      ))}
    </div>
  );
}

function LoggingGapItem({ gap }: { gap: LoggingGap }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-xs">
      <span className="text-gray-700 dark:text-gray-300">
        <span className="font-medium">{gap.metric === 'weight' ? 'No weigh-ins' : 'No stress logs'}</span>
        {' · '}{formatDate(gap.start, true)} to {formatDate(gap.end - 86400000, true)} · {gap.days} days
      </span>
      {gap.afterHighStress && <span className="font-semibold text-gray-700 dark:text-gray-200">After high stress</span>}
    </li>
  );
}

export default function WeightStressInsightChart({
  biometrics, stressEntries, rangeYears, weightDisplayUnit, loading,
}: WeightStressInsightChartProps) {
  const gapPatternId = useId();
  const [windowRange, setWindowRange] = useState<'dashboard' | 'month'>('dashboard');
  const today = new Date();
  const endDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const start = new Date(`${endDate}T00:00:00Z`);
  let startDate: string;
  if (windowRange === 'month') {
    start.setUTCDate(start.getUTCDate() - 29);
    startDate = start.toISOString().slice(0, 10);
  } else if (rangeYears === 'all') {
    startDate = [...biometrics.filter((entry) => entry.metric_type === 'weight'), ...(stressEntries ?? [])]
      .reduce((earliest, entry) => entry.date.slice(0, 10) < earliest ? entry.date.slice(0, 10) : earliest, endDate);
  } else {
    start.setUTCFullYear(start.getUTCFullYear() - rangeYears);
    startDate = start.toISOString().slice(0, 10);
  }
  const { points, windows, gaps } = buildWeightStressTimeline(
    biometrics, stressEntries ?? [], startDate, endDate, weightDisplayUnit,
  );
  const chartPoints = points.filter((point) => point.weight !== undefined
    || gaps.some((gap) => gap.metric === 'weight' && point.timestamp >= gap.start && point.timestamp < gap.end));
  const gapRegions: Array<{ start: number; end: number }> = [];
  gaps.forEach((gap) => {
    const previous = gapRegions[gapRegions.length - 1];
    if (previous && gap.start <= previous.end) previous.end = Math.max(previous.end, gap.end);
    else gapRegions.push({ start: gap.start, end: gap.end });
  });
  const latestGaps = gaps.slice().reverse();
  const weightDays = points.filter((point) => point.weight !== undefined).length;
  const stressDays = points.filter((point) => point.stressLevel !== undefined).length;

  return (
    <section className="rounded-lg bg-white p-4 shadow-lg sm:p-8 dark:bg-gray-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Weight &amp; stress windows</h2>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Beta</span>
        </div>
        <select
          aria-label="Weight and stress date range"
          value={windowRange}
          onChange={(event) => setWindowRange(event.target.value as 'dashboard' | 'month')}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="dashboard">Dashboard range</option>
          <option value="month">Last month</option>
        </select>
      </div>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-300">
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-cyan-600" />Weight ({weightDisplayUnit})</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 bg-amber-400/40" />Moderate stress (4 to &lt;8)</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 bg-red-500/30" />High stress (8 to 10)</span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 border border-dashed border-gray-400" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, #94a3b855 3px, #94a3b855 4px)' }} />
          Logging break (3+ days)
        </span>
      </div>
      {loading ? (
        <div className="flex h-[320px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">Loading insight data...</div>
      ) : weightDays === 0 ? (
        <div className="flex h-[320px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">No weigh-ins in this date range.</div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartPoints} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <defs>
              <pattern id={gapPatternId} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width={8} height={8} fill="#94a3b8" fillOpacity={0.06} />
                <line x1={0} y1={0} x2={0} y2={8} stroke="#94a3b8" strokeOpacity={0.45} strokeWidth={2} />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number" dataKey="timestamp" scale="time"
              domain={[Date.parse(`${startDate}T00:00:00Z`), Date.parse(`${endDate}T00:00:00Z`) + 86400000]}
              tickFormatter={(value: number) => formatDate(value, windowRange === 'dashboard')}
              tick={{ fontSize: 11 }} minTickGap={32}
            />
            <YAxis width={64} domain={['auto', 'auto']} tickFormatter={(value: number) => `${value} ${weightDisplayUnit}`} />
            {windows.map((window) => (
              <ReferenceArea
                key={window.start} x1={window.start} x2={window.end}
                fill={window.level === 'high' ? '#ef4444' : '#fbbf24'}
                fillOpacity={0.2} strokeOpacity={0} ifOverflow="hidden"
              />
            ))}
            {gapRegions.map((gap) => (
              <ReferenceArea
                key={gap.start}
                x1={Math.max(gap.start, Date.parse(`${startDate}T00:00:00Z`))}
                x2={Math.min(gap.end, Date.parse(`${endDate}T00:00:00Z`) + 86400000)}
                fill={`url(#${gapPatternId})`} fillOpacity={1}
                stroke="#94a3b8" strokeOpacity={0.6} strokeDasharray="4 4" ifOverflow="hidden"
              />
            ))}
            <Tooltip filterNull={false} content={<WeightStressTooltip unit={weightDisplayUnit} gaps={gaps} />} />
            <Line
              type="linear" dataKey="weight" name="Weight" stroke="#0891b2" strokeWidth={2.5}
              connectNulls={false} dot={{ r: 2 }} activeDot={{ r: 4 }} isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      {!loading && gaps.length > 0 && (
        <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Logging breaks</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{gaps.length} across weight and stress</span>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {latestGaps.slice(0, 3).map((gap) => <LoggingGapItem key={`${gap.metric}-${gap.start}`} gap={gap} />)}
          </ul>
          {latestGaps.length > 3 && (
            <details className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              <summary className="w-fit cursor-pointer py-2">{latestGaps.length - 3} earlier breaks</summary>
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {latestGaps.slice(3).map((gap) => <LoggingGapItem key={`${gap.metric}-${gap.start}`} gap={gap} />)}
              </ul>
            </details>
          )}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Breaks count 3+ consecutive days without an entry after that type of tracking began.
            {' '}After high stress means the preceding day averaged 8 or higher; the reason for the break is unknown.
          </p>
        </div>
      )}
      {!loading && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {weightDays} weigh-in days · {stressDays} stress-logged days.
          {' '}{stressEntries === null ? 'Stress data unavailable.' : stressDays === 0 ? 'No stress logged in this date range.' : 'Bands use daily average stress; unlogged days are not classified.'}
          {' '}Observed patterns do not establish causation.
        </p>
      )}
    </section>
  );
}