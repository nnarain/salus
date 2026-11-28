"use client";

import { memo, useId, useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BiometricEntry } from '@/lib/types';
import { getVisceralFatChartData, getVisceralFatScaleColor } from '@/lib/dashboardMetrics';
import type { VisceralFatChartPoint } from '@/lib/dashboardMetrics';
import { getChartRangeLabel, getChartRangeStart } from '@/lib/chartRange';

interface VisceralFatChartProps {
  biometrics: BiometricEntry[];
  rangeYears: number | 'all';
  loading: boolean;
  error?: string | null;
}

function VisceralFatDot({ cx, cy, payload }: {
  cx?: number;
  cy?: number;
  payload?: VisceralFatChartPoint;
}) {
  if (cx === undefined || cy === undefined || !payload || payload.ratio === null) return null;
  return <circle cx={cx} cy={cy} r={4} fill={getVisceralFatScaleColor(payload.ratio)} />;
}

function VisceralFatTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: VisceralFatChartPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point || point.ratio === null) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <p className="mb-2 font-semibold text-gray-900 dark:text-white">{point.date}</p>
      <p style={{ color: getVisceralFatScaleColor(point.ratio) }}>
        Scale position: {point.ratio.toFixed(3)} ({Math.round(point.ratio * 100)}%)
      </p>
      <p className="text-gray-600 dark:text-gray-300">Visceral fat: {point.value} level</p>
      <p className="text-gray-600 dark:text-gray-300">Device range: {point.scale_min} to {point.scale_max}</p>
    </div>
  );
}

function VisceralFatChart({ biometrics, rangeYears, loading, error }: VisceralFatChartProps) {
  const gradientId = useId();
  const chartData = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const start = rangeYears === 'all' ? -Infinity : getChartRangeStart(rangeYears, today).getTime();
    return getVisceralFatChartData(biometrics)
      .map((point) => ({ ...point, timestamp: new Date(`${point.date}T12:00:00`).getTime() }))
      .filter((point) => point.timestamp >= start && point.timestamp <= today.getTime());
  }, [biometrics, rangeYears]);
  const unavailableCount = chartData.filter((point) => point.ratio === null).length;
  const hasData = chartData.some((point) => point.ratio !== null);

  return (
    <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Visceral fat</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">{getChartRangeLabel(rangeYears)}</span>
      </div>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        Each measurement is normalized against its own device range, clamped to 0-1.
        Device-scale position only; not a clinical risk score.
      </p>
      <div className="mb-5 flex flex-wrap gap-4 text-xs">
        <span className="text-green-700 dark:text-green-400">0: low end / lower risk indication</span>
        <span className="text-red-700 dark:text-red-400">1: high end / higher risk indication</span>
      </div>
      {loading ? (
        <p className="text-gray-600 dark:text-gray-400">Loading visceral fat data...</p>
      ) : error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>
      ) : !hasData ? (
        <p className="text-gray-600 dark:text-gray-400">No scaled visceral fat measurements in this range. Add a measurement with a valid device minimum and maximum.</p>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData} margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={getVisceralFatScaleColor(1)} />
                <stop offset="50%" stopColor={getVisceralFatScaleColor(0.5)} />
                <stop offset="100%" stopColor={getVisceralFatScaleColor(0)} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value: number) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
              tick={{ fontSize: 11 }}
              minTickGap={32}
            />
            <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} label={{ value: 'Device-scale position', angle: -90, position: 'insideLeft' }} />
            <ReferenceArea y1={0} y2={1} fill={`url(#${gradientId})`} fillOpacity={0.12} strokeOpacity={0} />
            <Tooltip content={<VisceralFatTooltip />} />
            <Line
              type="linear"
              dataKey="ratio"
              name="Visceral fat scale position"
              stroke="#64748b"
              strokeWidth={2}
              connectNulls={false}
              dot={({ key, ...dotProps }) => <VisceralFatDot key={key} {...dotProps} />}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      {!loading && !error && unavailableCount > 0 && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {unavailableCount} measurement(s) have missing or invalid device ranges and are not plotted. Their ranges are not borrowed from other entries.
        </p>
      )}
    </section>
  );
}

export default memo(VisceralFatChart);
