"use client";

import { memo, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { NutritionEntry } from '@/lib/types';

interface NutritionChartProps {
  entries: NutritionEntry[] | null;
  rangeYears: number | 'all';
  loading: boolean;
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

function createSampleEntries(rangeYears: number | 'all'): NutritionEntry[] {
  const dayCount = rangeYears === 'all' ? 730 : Math.ceil(rangeYears * 365);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (dayCount - index - 1));
    return {
      date: dateToString(date),
      calories_kcal: 1750 + ((index * 83) % 850),
      protein_grams: 85 + ((index * 13) % 85),
      water_ml: 1400 + ((index * 227) % 2300),
    };
  });
}

function NutritionChart({ entries, rangeYears, loading }: NutritionChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<NutritionMetric>('calories_kcal');
  const metric = METRICS[selectedMetric];

  const { chartData, hasSampleData } = useMemo(() => {
    if (!entries) return { chartData: [], hasSampleData: false };

    const hasSampleData = entries.length === 0;
    const sourceEntries = hasSampleData ? createSampleEntries(rangeYears) : entries;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = new Date(today);

    if (rangeYears === 'all') {
      const earliestDate = sourceEntries.reduce<string | null>((earliest, entry) => {
        return earliest === null || entry.date < earliest ? entry.date : earliest;
      }, null);
      start = earliestDate ? new Date(`${earliestDate}T00:00:00`) : new Date(today.getTime() - 729 * 86400000);
    } else {
      start.setFullYear(start.getFullYear() - rangeYears);
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
          ? entry.calories_kcal
          : selectedMetric === 'protein_grams'
            ? entry.protein_grams
            : entry.water_ml / 1000;
      chartData.push({ date: dateString, value });
    }

    return { chartData, hasSampleData };
  }, [entries, rangeYears, selectedMetric]);

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
            {rangeYears === 'all' ? 'All available data' : `Last ${rangeYears} ${rangeYears === 1 ? 'year' : 'years'}`}
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
          <Bar dataKey="value" name={metric.label} fill={metric.color} maxBarSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

export default memo(NutritionChart);