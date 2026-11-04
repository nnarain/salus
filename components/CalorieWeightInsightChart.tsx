"use client";

import { memo, useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BiometricEntry, NutritionEntry, UserProfile } from '@/lib/types';
import { poundsToKilograms, kilogramsToPounds } from '@/lib/weight';
import { buildDailyCalorieBalance } from '@/lib/insights';
import { getChartRangeLabel, getChartRangeStart } from '@/lib/chartRange';

interface CalorieWeightInsightChartProps {
  nutritionEntries: NutritionEntry[] | null;
  biometrics: BiometricEntry[];
  profile: UserProfile | null;
  rangeYears: number | 'all';
  weightDisplayUnit: 'kg' | 'lbs';
  loading: boolean;
}

interface CalorieWeightPoint {
  date: string;
  intakeKcal?: number;
  estimatedMaintenanceKcal?: number;
  estimatedBalanceKcal?: number;
  sevenDayAverageBalanceKcal?: number;
  weight?: number;
  thirtyDayWeightAverage?: number;
}

interface BalanceTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CalorieWeightPoint }>;
}

interface WeightTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CalorieWeightPoint }>;
  weightDisplayUnit: 'kg' | 'lbs';
}

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

function BalanceTooltip({ active, payload }: BalanceTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (point.estimatedBalanceKcal === undefined) return null;

  return (
    <div className="rounded-lg border border-gray-200/60 bg-white/80 p-3 text-sm shadow-lg backdrop-blur-sm dark:border-gray-600/60 dark:bg-gray-800/80">
      <p className="mb-2 font-semibold text-gray-900 dark:text-white">{formatDate(point.date)}</p>
      <p className="text-gray-700 dark:text-gray-300">Intake: {point.intakeKcal?.toLocaleString()} kcal</p>
      <p className="text-gray-700 dark:text-gray-300">Estimated maintenance: {point.estimatedMaintenanceKcal?.toLocaleString()} kcal</p>
      <p className={point.estimatedBalanceKcal >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
        {point.estimatedBalanceKcal >= 0 ? 'Estimated deficit' : 'Estimated surplus'}: {Math.abs(point.estimatedBalanceKcal).toLocaleString()} kcal
      </p>
      {point.sevenDayAverageBalanceKcal !== undefined && (
        <p className="mt-1 text-gray-600 dark:text-gray-300">7-day average balance: {Math.round(point.sevenDayAverageBalanceKcal).toLocaleString()} kcal/day</p>
      )}
    </div>
  );
}

function WeightTooltip({ active, payload, weightDisplayUnit }: WeightTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (point.weight === undefined && point.thirtyDayWeightAverage === undefined) return null;

  return (
    <div className="rounded-lg border border-gray-200/60 bg-white/80 p-3 text-sm shadow-lg backdrop-blur-sm dark:border-gray-600/60 dark:bg-gray-800/80">
      <p className="mb-2 font-semibold text-gray-900 dark:text-white">{formatDate(point.date)}</p>
      {point.weight !== undefined && <p className="text-gray-700 dark:text-gray-300">Weigh-in: {point.weight.toFixed(1)} {weightDisplayUnit}</p>}
      {point.thirtyDayWeightAverage !== undefined && (
        <p className="text-teal-700 dark:text-teal-300">30-day average: {point.thirtyDayWeightAverage.toFixed(1)} {weightDisplayUnit}</p>
      )}
    </div>
  );
}

function CalorieWeightInsightChart({
  nutritionEntries,
  biometrics,
  profile,
  rangeYears,
  weightDisplayUnit,
  loading,
}: CalorieWeightInsightChartProps) {
  const chartData = useMemo(() => {
    if (!nutritionEntries || !profile) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const allDates = [
      ...nutritionEntries.map((entry) => entry.date),
      ...biometrics.filter((entry) => entry.metric_type === 'weight').map((entry) => entry.date.slice(0, 10)),
    ].filter((date) => date <= dateToString(today));
    if (allDates.length === 0) return [];

    let startDate: string;
    if (rangeYears === 'all') {
      startDate = allDates.reduce((earliest, date) => date < earliest ? date : earliest, allDates[0]);
    } else {
      const start = getChartRangeStart(rangeYears, today);
      startDate = dateToString(start);
    }
    const endDate = dateToString(today);
    const rangedNutrition = nutritionEntries.filter((entry) => entry.date >= startDate && entry.date <= endDate);
    const rangedBiometrics = biometrics.filter((entry) => {
      const date = entry.date.slice(0, 10);
      return entry.metric_type === 'weight' && date >= startDate && date <= endDate;
    });
    const dailyBalance = buildDailyCalorieBalance(rangedNutrition, rangedBiometrics, profile);
    const balanceByDate = new Map(dailyBalance.map((entry) => [entry.date, entry]));
    const weightByDate = new Map<string, { totalKg: number; count: number }>();

    rangedBiometrics.forEach((entry) => {
      const date = entry.date.slice(0, 10);
      const daily = weightByDate.get(date) ?? { totalKg: 0, count: 0 };
      daily.totalKg += entry.unit === 'lbs' ? poundsToKilograms(entry.value) : entry.value;
      daily.count++;
      weightByDate.set(date, daily);
    });

    const points: CalorieWeightPoint[] = [];
    for (const date = new Date(`${startDate}T00:00:00`); date <= today; date.setDate(date.getDate() + 1)) {
      const dateString = dateToString(date);
      const balance = balanceByDate.get(dateString);
      const dailyWeight = weightByDate.get(dateString);
      const recentBalances = [];
      const recentWeights = [];

      for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
        const day = new Date(`${dateString}T00:00:00Z`);
        day.setUTCDate(day.getUTCDate() - daysAgo);
        const balanceValue = balanceByDate.get(day.toISOString().slice(0, 10))?.estimatedBalanceKcal;
        if (balanceValue !== undefined) recentBalances.push(balanceValue);
      }
      for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
        const day = new Date(`${dateString}T00:00:00Z`);
        day.setUTCDate(day.getUTCDate() - daysAgo);
        const weightValue = weightByDate.get(day.toISOString().slice(0, 10));
        if (weightValue) recentWeights.push(weightValue.totalKg / weightValue.count);
      }

      const weightKg = dailyWeight ? dailyWeight.totalKg / dailyWeight.count : undefined;
      points.push({
        date: dateString,
        intakeKcal: balance?.intakeKcal,
        estimatedMaintenanceKcal: balance?.estimatedMaintenanceKcal,
        estimatedBalanceKcal: balance?.estimatedBalanceKcal,
        sevenDayAverageBalanceKcal: recentBalances.length >= 4
          ? recentBalances.reduce((sum, value) => sum + value, 0) / recentBalances.length
          : undefined,
        weight: weightKg === undefined
          ? undefined
          : Number((weightDisplayUnit === 'lbs' ? kilogramsToPounds(weightKg) : weightKg).toFixed(1)),
        thirtyDayWeightAverage: recentWeights.length >= 2
          ? Number(((recentWeights.reduce((sum, value) => sum + value, 0) / recentWeights.length)
            * (weightDisplayUnit === 'lbs' ? 1 / 0.45359237 : 1)).toFixed(1))
          : undefined,
      });
    }

    return points;
  }, [nutritionEntries, biometrics, profile, rangeYears, weightDisplayUnit]);

  const balanceDays = chartData.filter((point) => point.estimatedBalanceKcal !== undefined).length;
  const nutritionDays = chartData.filter((point) => point.intakeKcal !== undefined).length;
  const weightDays = chartData.filter((point) => point.weight !== undefined).length;
  const calorieAxisLimit = Math.max(500, ...chartData.map((point) => Math.abs(point.estimatedBalanceKcal ?? 0)));
  const calorieAxisStep = Math.ceil(calorieAxisLimit / 4 / 100) * 100;
  const calorieAxisMax = Math.max(calorieAxisStep * 4, 500);
  const tickInterval = Math.max(1, Math.floor(chartData.length / 7));

  if (loading) {
    return (
      <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Calorie balance &amp; weight trend</h2>
        <p className="text-gray-600 dark:text-gray-400">Loading insight data...</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Calorie balance &amp; weight trend</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {getChartRangeLabel(rangeYears)}
        </span>
      </div>
      <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">
        Estimated balance is maintenance minus intake. Historical maintenance uses the latest prior weigh-in, up to 30 days old; gaps mean there isn&apos;t enough data for an estimate.
      </p>

      <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Estimated daily calorie balance</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">{balanceDays} days with an estimate</span>
        </div>
        {balanceDays === 0 ? (
          <div className="flex h-[240px] items-center justify-center rounded-md border border-gray-200 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {nutritionDays === 0
              ? 'No calorie logs in this date range. Add daily intake to see the estimated balance.'
              : 'No estimates for these dates. They need complete formula settings and a weigh-in within the prior 30 days.'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide interval={tickInterval} />
              <YAxis
                width={64}
                domain={[-calorieAxisMax, calorieAxisMax]}
                tickFormatter={(value: number) => `${value} kcal`}
                label={{ value: 'Deficit  ←  kcal/day  →  Surplus', angle: -90, position: 'insideLeft' }}
              />
              <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />
              <Tooltip content={<BalanceTooltip />} />
              <Legend />
              <Bar dataKey="estimatedBalanceKcal" name="Estimated balance" maxBarSize={12}>
                {chartData.map((point) => (
                  <Cell
                    key={point.date}
                    fill={point.estimatedBalanceKcal === undefined
                      ? 'transparent'
                      : point.estimatedBalanceKcal >= 0 ? '#22c55e' : '#ef4444'}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="sevenDayAverageBalanceKcal"
                name="7-day average"
                stroke="#06b6d4"
                strokeWidth={2.5}
                connectNulls={false}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Recorded weight</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">{weightDays} weigh-in days</span>
        </div>
        {weightDays === 0 ? (
          <div className="flex h-[200px] items-center justify-center rounded-md border border-gray-200 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            No weigh-ins in this date range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                tick={{ fontSize: 11 }}
                interval={tickInterval}
                minTickGap={32}
              />
              <YAxis
                width={64}
                domain={['auto', 'auto']}
                tickFormatter={(value: number) => `${value} ${weightDisplayUnit}`}
                label={{ value: `Weight (${weightDisplayUnit})`, angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<WeightTooltip weightDisplayUnit={weightDisplayUnit} />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="weight"
                name="Weigh-in"
                stroke="#64748b"
                strokeWidth={1.5}
                connectNulls
                dot={{ r: 3, fill: '#64748b' }}
              />
              <Line
                type="monotone"
                dataKey="thirtyDayWeightAverage"
                name="30-day average"
                stroke="#0f9f8f"
                strokeWidth={3}
                connectNulls={false}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

export default memo(CalorieWeightInsightChart);