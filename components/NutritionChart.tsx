"use client";

import { memo, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { NutritionEntry } from '@/lib/types';
import type { CalorieEstimate } from '@/lib/calorieEstimate';
import { aggregateDailyNutrition } from '@/lib/nutritionSummary';
import { getChartRangeLabel, getChartRangeStart } from '@/lib/chartRange';

interface NutritionChartProps {
  entries: NutritionEntry[] | null;
  rangeYears: number | 'all';
  loading: boolean;
  maintenanceEstimate: CalorieEstimate | null;
  dailyCalorieTarget?: number;
  proteinTargetGrams?: number;
  proteinTargetWeightDate?: string;
}

type NutritionMetric = 'calories_kcal' | 'protein_grams' | 'water_liters';

interface NutritionChartPoint {
  date: string;
  value?: number;
}

const METRICS: Record<NutritionMetric, { label: string; unit: string; color: string }> = {
  calories_kcal: { label: 'Calories', unit: 'kcal', color: '#f59e0b' },
  protein_grams: { label: 'Protein', unit: 'g', color: '#06b6d4' },
  water_liters: { label: 'Water', unit: 'L', color: '#0f9f8f' },
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

function createSampleEntries(
  rangeYears: number | 'all',
  maintenanceEstimate: CalorieEstimate | null,
  proteinTargetGrams?: number,
): NutritionEntry[] {
  const dayCount = rangeYears === 'all' ? 730 : Math.ceil(rangeYears * 365);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const caloriePhases = [-260, -220, -120, -100, 30, 60, 220, 180, 90, 40, -110, -180];
  const calorieDailyVariation = [-60, 25, 45, -35, 70, -15, -30];
  const proteinPhases = [-10, -8, -4, 0, 3, 10, 14, 8, 4, 0, -5, -8];
  const proteinDailyVariation = [-5, 2, 4, -3, 6, 0, -2];
  const waterDailyPattern = [2100, 2500, 2250, 2800, 1900, 2600, 2300];
  const calorieBaseline = maintenanceEstimate?.caloriesKcal ?? 2200;
  const proteinBaseline = proteinTargetGrams ?? 100;

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (dayCount - index - 1));
    const phaseIndex = Math.floor(index / 28) % caloriePhases.length;
    const dayIndex = index % 7;
    return {
      date: dateToString(date),
      calories_kcal: Math.round(calorieBaseline + caloriePhases[phaseIndex] + calorieDailyVariation[dayIndex]),
      protein_grams: Math.max(20, Number((proteinBaseline + proteinPhases[phaseIndex] + proteinDailyVariation[dayIndex]).toFixed(1))),
      water_ml: waterDailyPattern[dayIndex] + ((phaseIndex % 3) - 1) * 150,
    };
  });
}

function NutritionChart({
  entries,
  rangeYears,
  loading,
  maintenanceEstimate,
  dailyCalorieTarget,
  proteinTargetGrams,
  proteinTargetWeightDate,
}: NutritionChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<NutritionMetric>('calories_kcal');
  const metric = METRICS[selectedMetric];
  const hasDailyCalorieTarget = typeof dailyCalorieTarget === 'number' && Number.isFinite(dailyCalorieTarget);
  const showCalorieTargetLine = hasDailyCalorieTarget && dailyCalorieTarget !== maintenanceEstimate?.caloriesKcal;
  const proteinTargetDateLabel = proteinTargetWeightDate
    ? new Date(`${proteinTargetWeightDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : undefined;

  const { chartData, hasSampleData } = useMemo(() => {
    if (!entries) return { chartData: [], hasSampleData: false };

    const hasSampleData = entries.length === 0;
    const sourceEntries = hasSampleData
      ? createSampleEntries(rangeYears, maintenanceEstimate, proteinTargetGrams)
      : aggregateDailyNutrition(entries);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = new Date(today);

    if (rangeYears === 'all') {
      const earliestDate = sourceEntries.reduce<string | null>((earliest, entry) => {
        return earliest === null || entry.date < earliest ? entry.date : earliest;
      }, null);
      start = earliestDate ? new Date(`${earliestDate}T00:00:00`) : new Date(today.getTime() - 729 * 86400000);
    } else {
      start = getChartRangeStart(rangeYears, today);
    }

    const startDate = dateToString(start);
    const endDate = dateToString(today);
    const entriesByDate = new Map(
      sourceEntries
        .filter((entry) => entry.date >= startDate && entry.date <= endDate)
        .map((entry) => [entry.date, entry]),
    );
    const chartData: NutritionChartPoint[] = [];

    for (const date = new Date(start); date <= today; date.setDate(date.getDate() + 1)) {
      const dateString = dateToString(date);
      const entry = entriesByDate.get(dateString);
      const value = !entry
        ? undefined
        : selectedMetric === 'calories_kcal'
          ? entry.calories_kcal ?? undefined
          : selectedMetric === 'protein_grams'
            ? entry.protein_grams ?? undefined
            : entry.water_ml == null ? undefined : entry.water_ml / 1000;
      chartData.push({ date: dateString, value });
    }

    return { chartData, hasSampleData };
  }, [entries, rangeYears, selectedMetric, maintenanceEstimate, proteinTargetGrams]);

  if (loading) {
    return (
      <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Daily nutrition</h2>
        <p className="text-gray-600 dark:text-gray-400">Loading nutrition data...</p>
      </section>
    );
  }

  if (entries === null) {
    return (
      <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Daily nutrition</h2>
        <p className="text-gray-600 dark:text-gray-400">Nutrition data is unavailable.</p>
      </section>
    );
  }

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));
  const getBarColor = (value?: number): string => {
    if (value === undefined) return metric.color;
    if (selectedMetric === 'calories_kcal' && maintenanceEstimate) {
      if (value < maintenanceEstimate.caloriesKcal) return '#22c55e';
      if (value > maintenanceEstimate.caloriesKcal) return '#ef4444';
      return '#94a3b8';
    }
    if (selectedMetric === 'protein_grams' && proteinTargetGrams !== undefined) {
      return value >= proteinTargetGrams ? '#22c55e' : '#f59e0b';
    }
    return metric.color;
  };

  return (
    <section className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Daily nutrition</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {hasSampleData ? 'Example values only; they are not saved.' : 'Recorded daily totals.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasSampleData && (
            <span className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Sample preview</span>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {getChartRangeLabel(rangeYears)}
          </span>
        </div>
      </div>

      <div className="mb-5 inline-flex rounded-lg border border-gray-300 p-1 dark:border-gray-600" role="group" aria-label="Nutrition metric">
        {(Object.keys(METRICS) as NutritionMetric[]).map((metricKey) => (
          <button
            key={metricKey}
            type="button"
            aria-pressed={selectedMetric === metricKey}
            onClick={() => setSelectedMetric(metricKey)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedMetric === metricKey
                ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/60'
            }`}
          >
            {METRICS[metricKey].label}
          </button>
        ))}
      </div>

      {selectedMetric === 'calories_kcal' && (
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
          {hasSampleData && <span>Sample bars only; lines and colors use your saved estimates.</span>}
          {maintenanceEstimate ? (
            <span className="flex items-center gap-2">
              <span className="w-5 border-t-[3px] border-cyan-400" />
              Estimated maintenance: <strong>{maintenanceEstimate.caloriesKcal.toLocaleString()} kcal</strong>
              <span className="text-xs">({maintenanceEstimate.source === 'logged_data' ? 'trend estimate' : 'formula estimate'})</span>
            </span>
          ) : (
            <span>Estimated maintenance: not available</span>
          )}
          <span>Daily target: <strong>{hasDailyCalorieTarget ? `${dailyCalorieTarget.toLocaleString()} kcal` : 'Not set'}</strong></span>
          {showCalorieTargetLine && (
            <span className="flex items-center gap-2">
              <span className="w-5 border-t-[3px] border-violet-500" />Your target
            </span>
          )}
          {!hasSampleData && maintenanceEstimate && (
            <span className="text-xs text-gray-500 dark:text-gray-400">Green bars are below maintenance; red bars are above.</span>
          )}
        </div>
      )}
      {selectedMetric === 'protein_grams' && (
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
          {hasSampleData && <span>Sample bars only.</span>}
          {proteinTargetGrams !== undefined ? (
            <span className="flex items-center gap-2">
              <span className="w-5 border-t-[3px] border-cyan-400" />
              Baseline estimate: <strong>{proteinTargetGrams} g/day</strong> at 0.8 g/kg
              {proteinTargetDateLabel && <span className="text-xs">(weight from {proteinTargetDateLabel})</span>}
            </span>
          ) : (
            <span>Add a weight entry to estimate the adult protein baseline.</span>
          )}
          {!hasSampleData && proteinTargetGrams !== undefined && (
            <span className="text-xs text-gray-500 dark:text-gray-400">Amber is below; green is at or above the estimate.</span>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 8 }} barCategoryGap={1}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
            tick={{ fontSize: 11 }}
            interval={tickInterval}
            minTickGap={32}
          />
          <YAxis
            allowDecimals={selectedMetric !== 'calories_kcal'}
            tickFormatter={(value: number) => `${value} ${metric.unit}`}
            label={{ value: metric.unit, angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value) => [`${Number(value).toLocaleString()} ${metric.unit}`, metric.label]}
          />
          <Bar dataKey="value" name={metric.label} fill={metric.color} maxBarSize={12}>
            {chartData.map((point) => (
              <Cell key={point.date} fill={getBarColor(point.value)} />
            ))}
          </Bar>
          {selectedMetric === 'calories_kcal' && maintenanceEstimate && (
            <ReferenceLine
              y={maintenanceEstimate.caloriesKcal}
              stroke="#22d3ee"
              strokeWidth={3}
              ifOverflow="extendDomain"
            />
          )}
          {selectedMetric === 'calories_kcal' && showCalorieTargetLine && (
            <ReferenceLine
              y={dailyCalorieTarget}
              stroke="#8b5cf6"
              strokeWidth={3}
              ifOverflow="extendDomain"
            />
          )}
          {selectedMetric === 'protein_grams' && proteinTargetGrams !== undefined && (
            <ReferenceLine
              y={proteinTargetGrams}
              stroke="#22d3ee"
              strokeWidth={3}
              ifOverflow="extendDomain"
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

export default memo(NutritionChart);