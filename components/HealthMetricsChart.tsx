"use client";

import { memo, useState } from 'react';
import { Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, ComposedChart } from 'recharts';
import type { BiometricEntry, BodyFatEstimate, UserProfile } from '@/lib/types';
import { averageBodyFatPercentage } from '@/lib/bodyFat';
import { getChartRangeLabel, getChartRangeStart } from '@/lib/chartRange';
import { kilogramsToPounds, poundsToKilograms } from '@/lib/weight';
import { getRiskLevelDescription, getRiskLevelColor, getVisceralFatScaleRatio, normalizeHealthMetric, BODY_FAT_ANCHORS, WAIST_HEIGHT_ANCHORS } from '@/lib/healthRisk';
import { getRiskHistory } from '@/lib/riskJourney';

interface HealthMetricsChartProps {
  biometrics: BiometricEntry[];
  bodyFatEstimates?: BodyFatEstimate[];
  profile: UserProfile | null;
  rangeYears: number | 'all';
  weightDisplayUnit: 'kg' | 'lbs';
}

interface ChartDataPoint {
  date: string;
  weight?: number;
  muscleMass?: number;
  waistHeightRatio?: number;
  bodyFatPercentage?: number;
  estimatedBodyFatPercentage?: number;
  averageBodyFatPercentage?: number;
  healthRisk?: number;
  normalizedWaistHeight?: number;
  normalizedBodyFat?: number;
  normalizedVisceralFat?: number;
  averagedNormalizedRisk?: number;
  riskFactors?: RiskFactor[];
  waistContribution?: number;
  bodyFatContribution?: number;
  visceralFatContribution?: number;
  contributionTotal?: number;
}

interface RiskFactor {
  contributionKey: 'waistContribution' | 'bodyFatContribution' | 'visceralFatContribution';
  name: string;
  score: number;
  date: string;
  color: string;
}

const CONTRIBUTION_SERIES = [
  { dataKey: 'waistContribution', name: 'Waist-to-height', color: '#ec4899' },
  { dataKey: 'bodyFatContribution', name: 'Body fat %', color: '#06b6d4' },
  { dataKey: 'visceralFatContribution', name: 'Visceral fat', color: '#f97316' },
] as const;

interface TooltipPayloadItem {
  dataKey: string;
  name: string;
  value: number;
  color: string;
  payload: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  weightDisplayUnit: 'kg' | 'lbs';
  showRiskInsights?: boolean;
}

// Health range thresholds
const WAIST_HEIGHT_RANGES = {
  healthy: 0.5,
  increased: 0.6,
};

// Get color for waist-to-height ratio
const getWaistHeightColor = (ratio: number): string => {
  if (ratio < WAIST_HEIGHT_RANGES.healthy) {
    return '#10b981'; // green
  } else if (ratio < WAIST_HEIGHT_RANGES.increased) {
    return '#f59e0b'; // amber
  } else {
    return '#ef4444'; // red
  }
};

// Get color for body fat percentage (assuming average gender distribution)
const getBodyFatColor = (percentage: number): string => {
  // Using general ranges
  if (percentage < 18) {
    return '#3b82f6'; // blue - athletic
  } else if (percentage < 25) {
    return '#10b981'; // green - fitness
  } else if (percentage < 32) {
    return '#f59e0b'; // amber - average
  } else {
    return '#ef4444'; // red - obese
  }
};

// Custom tooltip to show color-coded insights
const CustomTooltip = ({ active, payload, weightDisplayUnit, showRiskInsights = true }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="font-semibold mb-2">{payload[0].payload.date}</p>
        {payload.map((entry: TooltipPayloadItem, index: number) => {
          let insight = '';
          let color = entry.color;

          if (entry.dataKey === 'waistHeightRatio' && entry.value) {
            const ratio = entry.value;
            color = getWaistHeightColor(ratio);
            if (ratio < WAIST_HEIGHT_RANGES.healthy) {
              insight = ' (Healthy)';
            } else if (ratio < WAIST_HEIGHT_RANGES.increased) {
              insight = ' (Increased Risk)';
            } else {
              insight = ' (High Risk)';
            }
          } else if (entry.dataKey === 'bodyFatPercentage' && entry.value && showRiskInsights) {
            const percentage = entry.value;
            color = getBodyFatColor(percentage);
            if (percentage < 18) {
              insight = ' (Athletic)';
            } else if (percentage < 25) {
              insight = ' (Fitness)';
            } else if (percentage < 32) {
              insight = ' (Average)';
            } else {
              insight = ' (High)';
            }
          } else if (entry.dataKey === 'healthRisk' && entry.value !== undefined) {
            const riskScore = entry.value;
            color = getRiskLevelColor(riskScore);
            insight = ` (${getRiskLevelDescription(riskScore)})`;
          } else if (entry.dataKey === 'normalizedWaistHeight' && entry.value !== undefined) {
            const normalized = entry.value;
            color = getRiskLevelColor(normalized);
            insight = ` (${getRiskLevelDescription(normalized)})`;
          } else if (entry.dataKey === 'normalizedBodyFat' && entry.value !== undefined) {
            const normalized = entry.value;
            color = getRiskLevelColor(normalized);
            insight = ` (${getRiskLevelDescription(normalized)})`;
          } else if (entry.dataKey === 'normalizedVisceralFat' && entry.value !== undefined) {
            color = getRiskLevelColor(entry.value);
            insight = ' (Device-scale position)';
          } else if (entry.dataKey === 'averagedNormalizedRisk' && entry.value !== undefined) {
            const normalized = entry.value;
            color = getRiskLevelColor(normalized);
            insight = ` (${getRiskLevelDescription(normalized)})`;
          }

          return (
            <p key={index} style={{ color }} className="text-sm">
              {entry.name}: {['weight', 'muscleMass', 'bodyFatPercentage', 'estimatedBodyFatPercentage', 'averageBodyFatPercentage'].includes(entry.dataKey) ? entry.value.toFixed(1) : entry.value.toFixed(3)}
              {(entry.dataKey === 'weight' || entry.dataKey === 'muscleMass') && ` ${weightDisplayUnit}`}
              {['bodyFatPercentage', 'estimatedBodyFatPercentage', 'averageBodyFatPercentage'].includes(entry.dataKey) && '%'}
              {entry.dataKey === 'healthRisk' && ` - ${(entry.value * 100).toFixed(0)}%`}
              <span className="font-semibold">{insight}</span>
            </p>
          );
        })}
        {!showRiskInsights && (
          <>
            {payload[0].payload.averageBodyFatPercentage !== undefined && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                {payload[0].payload.bodyFatPercentage !== undefined && payload[0].payload.estimatedBodyFatPercentage !== undefined
                  ? `Same-day average: (${payload[0].payload.bodyFatPercentage}% logged + ${payload[0].payload.estimatedBodyFatPercentage}% RFM) / 2`
                  : 'Body fat uses the single available source for this date.'}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              Risk: {payload[0].payload.healthRisk === undefined ? 'Unavailable' : getRiskLevelDescription(payload[0].payload.healthRisk)}
            </p>
          </>
        )}
      </div>
    );
  }
  return null;
};

function NormalizedRiskTooltip({ active, payload }: Pick<CustomTooltipProps, 'active' | 'payload'>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const factors = point.riskFactors ?? [];
  return (
    <div className="max-w-sm rounded-lg border border-violet-200 bg-white p-4 shadow-xl dark:border-violet-700 dark:bg-gray-800">
      <p className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">{point.date}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Health risk indicator</p>
      <p className="mt-1 text-2xl font-bold text-violet-700 dark:text-violet-300">
        {point.averagedNormalizedRisk?.toFixed(3) ?? 'Unavailable'}
        {point.averagedNormalizedRisk !== undefined && <span className="ml-2 text-sm font-normal">/ 1 · {getRiskLevelDescription(point.averagedNormalizedRisk)}</span>}
      </p>
      {factors.length > 0 && (
        <>
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-300">
            Each factor contributes its normalized score divided by {factors.length}.
          </p>
          <div role="img" aria-label="Factor contributions to the overall 0-1 score" className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            {factors.map((factor) => <span key={factor.name} style={{ backgroundColor: factor.color, width: `${factor.score / factors.length * 100}%` }} />)}
          </div>
          <table className="mt-3 w-full text-xs text-gray-700 dark:text-gray-200">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 text-left font-medium">Contributing factor</th>
                <th className="pb-2 pl-3 text-right font-medium">Score</th>
                <th className="pb-2 pl-3 text-right font-medium">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {factors.map((factor) => (
                <tr key={factor.name}>
                  <td className="pt-2">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: factor.color }} />
                    {factor.name}
                    <span className="block text-gray-500 dark:text-gray-400">Reading: {factor.date}</span>
                  </td>
                  <td className="pt-2 pl-3 text-right tabular-nums">{factor.score.toFixed(3)}</td>
                  <td className="pt-2 pl-3 text-right font-semibold tabular-nums">{(factor.score / factors.length).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Latest available readings as of this date. Values shown are rounded.</p>
          {factors.some((factor) => factor.name === 'Visceral fat') && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Visceral fat: device-scale position, not a clinical risk threshold.</p>
          )}
        </>
      )}
    </div>
  );
}

// Helper function to get risk level category
const getRiskLevel = (riskScore: number | undefined): 'low' | 'moderate' | 'high' | null => {
  if (riskScore === undefined || riskScore === null) return null;
  if (riskScore < 0.33) return 'low';
  if (riskScore < 0.67) return 'moderate';
  return 'high';
};

// Helper function to generate risk zones for reference areas
interface RiskZone {
  x1: number;
  x2: number;
  level: 'low' | 'moderate' | 'high';
}

const generateRiskZones = (chartData: ChartDataPoint[]): RiskZone[] => {
  const zones: RiskZone[] = [];
  chartData.forEach((point, index) => {
    const riskLevel = getRiskLevel(point.healthRisk);
    if (!riskLevel) return;
    const time = new Date(point.date).getTime();
    const previous = chartData[index - 1];
    const next = chartData[index + 1];
    const x1 = previous ? (new Date(previous.date).getTime() + time) / 2
      : time - (chartData.length === 1 ? 43200000 : 0);
    const x2 = next ? (new Date(next.date).getTime() + time) / 2
      : time + (chartData.length === 1 ? 43200000 : 0);
    const lastZone = zones[zones.length - 1];
    if (lastZone?.level === riskLevel && lastZone.x2 === x1) {
      lastZone.x2 = x2;
    } else {
      zones.push({ x1, x2, level: riskLevel });
    }
  });

  return zones;
};

// Process biometric data into chart format
const processChartData = (biometrics: BiometricEntry[], profile: UserProfile | null, bodyFatEstimates: BodyFatEstimate[], riskEntries: BiometricEntry[]): ChartDataPoint[] => {
  const dataByDate = new Map<string, ChartDataPoint>();
  const riskByDate = new Map(getRiskHistory(riskEntries, profile).map((point) => [point.date, point]));

  biometrics.slice().sort((first, second) => first.date.localeCompare(second.date)
    || (first.created_at ?? '').localeCompare(second.created_at ?? '')
    || (first.id ?? '').localeCompare(second.id ?? '')).forEach((entry) => {
    const date = entry.date;
    if (!dataByDate.has(date)) {
      dataByDate.set(date, { date });
    }
    const dataPoint = dataByDate.get(date)!;

    if (entry.metric_type === 'weight') {
      // Convert to kg for consistency
      let weightInKg = entry.value;
      if (entry.unit === 'lbs') {
        weightInKg = poundsToKilograms(entry.value);
      }
      dataPoint.weight = Number(weightInKg.toFixed(1));
    } else if (entry.metric_type === 'waistline' && profile?.height) {
      // Calculate waist-to-height ratio
      let heightInCm = profile.height;
      if (profile.height_unit === 'inches') {
        heightInCm = profile.height * 2.54;
      } else if (profile.height_unit === 'feet') {
        heightInCm = profile.height * 30.48;
      }

      let waistInCm = entry.value;
      if (entry.unit === 'inches') {
        waistInCm = entry.value * 2.54;
      }

      const ratio = waistInCm / heightInCm;
      dataPoint.waistHeightRatio = Number(ratio.toFixed(3));
    } else if (entry.metric_type === 'body_fat_percentage') {
      dataPoint.bodyFatPercentage = Number(entry.value.toFixed(1));
    } else if (entry.metric_type === 'muscle_mass') {
      dataPoint.muscleMass = Number(entry.value.toFixed(1));
    } else if (entry.metric_type === 'visceral_fat_level') {
      dataPoint.normalizedVisceralFat = getVisceralFatScaleRatio(entry) ?? undefined;
    }
  });

  bodyFatEstimates.forEach((estimate) => {
    const dataPoint = dataByDate.get(estimate.date) ?? { date: estimate.date };
    dataPoint.estimatedBodyFatPercentage = estimate.percentage;
    dataByDate.set(estimate.date, dataPoint);
  });

  // Convert to array and sort by date
  const chartData = Array.from(dataByDate.values()).sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Calculate health risk for each data point
  chartData.forEach((dataPoint) => {
    dataPoint.averageBodyFatPercentage = averageBodyFatPercentage(
      dataPoint.bodyFatPercentage, dataPoint.estimatedBodyFatPercentage);
    const snapshot = riskByDate.get(dataPoint.date);
    if (snapshot?.score != null) {
      dataPoint.healthRisk = Number(snapshot.score.toFixed(3));
      dataPoint.averagedNormalizedRisk = dataPoint.healthRisk;
      const factors: RiskFactor[] = [];
      if (snapshot.waist) factors.push({
        contributionKey: 'waistContribution',
        name: 'Waist-to-height', color: '#ec4899', date: snapshot.waist.date,
        score: normalizeHealthMetric(snapshot.waist.value, WAIST_HEIGHT_ANCHORS.ideal, WAIST_HEIGHT_ANCHORS.threshold),
      });
      if (snapshot.bodyFat) factors.push({
        contributionKey: 'bodyFatContribution',
        name: 'Body fat %', color: '#06b6d4', date: snapshot.bodyFat.date,
        score: normalizeHealthMetric(snapshot.bodyFat.value, BODY_FAT_ANCHORS.ideal, BODY_FAT_ANCHORS.threshold),
      });
      if (snapshot.visceralFat) factors.push({
        contributionKey: 'visceralFatContribution',
        name: 'Visceral fat', color: '#f97316', date: snapshot.visceralFat.date,
        score: snapshot.visceralFat.value,
      });
      dataPoint.riskFactors = factors;
      dataPoint.waistContribution = 0;
      dataPoint.bodyFatContribution = 0;
      dataPoint.visceralFatContribution = 0;
      for (const factor of factors) dataPoint[factor.contributionKey] = factor.score / factors.length;
      dataPoint.contributionTotal = snapshot.score;
    }

    // Calculate normalized values
    if (dataPoint.waistHeightRatio !== undefined) {
      const normalized = normalizeHealthMetric(
        dataPoint.waistHeightRatio,
        WAIST_HEIGHT_ANCHORS.ideal,
        WAIST_HEIGHT_ANCHORS.threshold
      );
      dataPoint.normalizedWaistHeight = Number(normalized.toFixed(3));
    }

    if (dataPoint.bodyFatPercentage !== undefined) {
      const normalized = normalizeHealthMetric(
        dataPoint.bodyFatPercentage,
        BODY_FAT_ANCHORS.ideal,
        BODY_FAT_ANCHORS.threshold
      );
      dataPoint.normalizedBodyFat = Number(normalized.toFixed(3));
    }
  });

  return chartData;
};

function HealthMetricsChart({
  biometrics,
  bodyFatEstimates = [],
  profile,
  rangeYears,
  weightDisplayUnit,
}: HealthMetricsChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<string[]>(['bodyFatPercentage', 'estimatedBodyFatPercentage']);
  const [riskView, setRiskView] = useState<'trends' | 'contributions'>('trends');
  const cutoffDate = rangeYears === 'all' ? new Date() : getChartRangeStart(rangeYears);
  const visibleBiometrics = rangeYears === 'all'
    ? biometrics
    : biometrics.filter((entry) => new Date(`${entry.date.slice(0, 10)}T00:00:00`) >= cutoffDate);
  const visibleEstimates = rangeYears === 'all'
    ? bodyFatEstimates
    : bodyFatEstimates.filter((estimate) => new Date(`${estimate.date.slice(0, 10)}T00:00:00`) >= cutoffDate);
  const chartData = processChartData(visibleBiometrics, profile, visibleEstimates, biometrics);
  const weightChartData = weightDisplayUnit === 'lbs'
    ? chartData.map((point) => ({
      ...point,
      weight: point.weight === undefined ? undefined : Number(kilogramsToPounds(point.weight).toFixed(1)),
      muscleMass: point.muscleMass === undefined ? undefined : Number(kilogramsToPounds(point.muscleMass).toFixed(1)),
    }))
    : chartData;
  const compositionData = weightChartData.map((point) => ({ ...point, timestamp: new Date(point.date).getTime() }));
  const hasEstimatedBodyFat = compositionData.some((point) => point.estimatedBodyFatPercentage !== undefined);
  const hasNormalizedWaist = chartData.some((point) => point.normalizedWaistHeight !== undefined);
  const hasNormalizedBodyFat = chartData.some((point) => point.normalizedBodyFat !== undefined);
  const hasNormalizedVisceralFat = chartData.some((point) => point.normalizedVisceralFat !== undefined);
  const hasAveragedRisk = chartData.some((point) => point.averagedNormalizedRisk !== undefined);
  const contributionSeries = CONTRIBUTION_SERIES.filter((series) =>
    chartData.some((point) => point.riskFactors?.some((factor) => factor.contributionKey === series.dataKey)));
  const rangeLabel = getChartRangeLabel(rangeYears);
  if (chartData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Weight & Body Composition</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">{rangeLabel}</span>
          </div>
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              {biometrics.length > 0
                ? 'No measurements in this date range. Choose a longer range above.'
                : 'No data available yet. Start adding biometric measurements to see your progress!'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Normalized Health Risk Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Health Risk Metrics (Normalized)</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-gray-300 p-1 dark:border-gray-600" role="group" aria-label="Risk chart view">
              {(['trends', 'contributions'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={riskView === view}
                  onClick={() => setRiskView(view)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-violet-600 ${riskView === view
                    ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                >
                  {view === 'trends' ? 'Trends' : 'Contributions'}
                </button>
              ))}
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{rangeLabel}</span>
          </div>
        </div>
        <div className="mb-4">
          {hasAveragedRisk && (
            <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-700 dark:bg-violet-950/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Main progression indicator</p>
              <div className="mt-1 flex items-center gap-3">
                <span className="w-10 border-t-4 border-violet-600" aria-hidden="true" />
                <span className="text-lg font-bold text-violet-800 dark:text-violet-200">Health risk indicator (average)</span>
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                The bold purple line combines the factors below into the same overall score used by Health Progression.
                Hover a date to see each factor&apos;s contribution.
              </p>
            </div>
          )}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Contributing factors · equal weight when available</p>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            {riskView === 'contributions' ? contributionSeries.map((series) => (
              <div key={series.dataKey} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: series.color }} />
                <span>{series.name}</span>
              </div>
            )) : (
              <>
                {hasNormalizedWaist && (
                  <div className="flex items-center gap-2">
                    <div className="w-5 border-t-2 border-dashed border-pink-500"></div>
                    <span>Normalized Waist-to-Height Ratio</span>
                  </div>
                )}
                {hasNormalizedBodyFat && (
                  <div className="flex items-center gap-2">
                    <div className="w-5 border-t-2 border-dashed border-cyan-500"></div>
                    <span>Normalized Body Fat %</span>
                  </div>
                )}
                {hasNormalizedVisceralFat && (
                  <div className="flex items-center gap-2">
                    <div className="w-5 border-t-2 border-dashed border-orange-500"></div>
                    <span>Normalized Visceral Fat</span>
                  </div>
                )}
              </>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {riskView === 'contributions'
              ? 'Colored bands show each normalized factor score divided by the number of available factors. Their combined top edge is the purple overall indicator; the background zones apply to that total.'
              : 'Compare the normalized factor lines to see which measurements are changing faster or slower.'}
          </p>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            <p>💡 Normalized metrics show health risk on a 0-1 scale where 0 = ideal health, 1 = high risk threshold.</p>
            <p>💡 Waist-to-Height: 0 = {WAIST_HEIGHT_ANCHORS.ideal}, 1 = {WAIST_HEIGHT_ANCHORS.threshold} | Body Fat: 0 = {BODY_FAT_ANCHORS.ideal}%, 1 = {BODY_FAT_ANCHORS.threshold}%</p>
            <p>💡 Visceral Fat: 0 = device minimum, 1 = device maximum, using each entry&apos;s own range. Device scales are proprietary, not clinical risk thresholds.</p>
            <p>💡 Averaged Health Risk equally weights the latest available logged waist-to-height, body fat, and scaled visceral fat readings as of each measurement date. Missing factors are not counted as zero.</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              domain={[0, 1]}
              tickFormatter={(value) => {
                if (value === 0) return 'Low Risk (0)';
                if (value === 1) return 'High Risk (1)';
                return value.toFixed(1);
              }}
            />
            <Tooltip content={<NormalizedRiskTooltip />} />
            {/* Reference lines for risk levels */}
            <ReferenceArea y1={0} y2={0.33} fill="rgba(34, 197, 94, 0.1)" fillOpacity={1} />
            <ReferenceArea y1={0.33} y2={0.67} fill="rgba(251, 191, 36, 0.1)" fillOpacity={1} />
            <ReferenceArea y1={0.67} y2={1} fill="rgba(239, 68, 68, 0.1)" fillOpacity={1} />
            {riskView === 'contributions' && contributionSeries.map((series) => (
              <Area
                key={series.dataKey}
                type="linear"
                dataKey={series.dataKey}
                name={series.name}
                stackId="risk-contributions"
                stroke={series.color}
                strokeWidth={1}
                strokeOpacity={0.6}
                fill={series.color}
                fillOpacity={0.22}
                connectNulls={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
            {riskView === 'trends' && hasNormalizedWaist && <Line
              type="monotone" 
              dataKey="normalizedWaistHeight" 
              stroke="#ec4899" 
              strokeWidth={2} 
              strokeOpacity={0.7}
              strokeDasharray="6 3"
              name="Normalized Waist-to-Height"
              connectNulls
              dot={false}
            />}
            {riskView === 'trends' && hasNormalizedBodyFat && <Line
              type="monotone" 
              dataKey="normalizedBodyFat" 
              stroke="#06b6d4" 
              strokeWidth={2} 
              strokeOpacity={0.7}
              strokeDasharray="5 4"
              name="Normalized Body Fat %"
              connectNulls
              dot={false}
            />}
            {riskView === 'trends' && hasNormalizedVisceralFat && <Line
              type="linear"
              dataKey="normalizedVisceralFat"
              stroke="#f97316"
              strokeWidth={2}
              strokeOpacity={0.7}
              strokeDasharray="3 3"
              name="Normalized Visceral Fat"
              connectNulls={false}
              dot={{ r: 3 }}
            />}
            {hasAveragedRisk && <Line
              type={riskView === 'contributions' ? 'linear' : 'monotone'}
              dataKey={riskView === 'contributions' ? 'contributionTotal' : 'averagedNormalizedRisk'}
              stroke="#7c3aed"
              strokeWidth={4.5}
              name="Health risk indicator (average)"
              connectNulls={false}
              dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 7, strokeWidth: 2 }}
              isAnimationActive={riskView === 'trends'}
            />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <section aria-label="Body composition" className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Weight & Body Composition</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">{rangeLabel}</span>
        </div>
        {compositionData.length === 0 ? (
          <p className="py-12 text-center text-gray-600 dark:text-gray-400">No body fat, muscle mass, or weight measurements in this date range.</p>
        ) : (
          <>
        <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
          {(['low', 'moderate', 'high'] as const).map((level) => (
            <span key={level} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: getRiskLevelColor(level === 'low' ? 0 : level === 'moderate' ? 0.5 : 1) }} />
              {level === 'low' ? 'Low' : level === 'moderate' ? 'Moderate' : 'High'} Risk Zone
            </span>
          ))}
        </div>
        <div className="mb-2 flex justify-between gap-4 text-xs text-gray-600 dark:text-gray-400">
          <span>Body fat (%)</span>
          <span>Mass ({weightDisplayUnit})</span>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={compositionData} margin={{ top: 8, right: 0, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={compositionData.length === 1
                ? [compositionData[0].timestamp - 43200000, compositionData[0].timestamp + 43200000]
                : ['dataMin', 'dataMax']}
              tickFormatter={(value: number) => new Date(value).toISOString().slice(0, 10)}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis yAxisId="percentage" orientation="left" width={44} domain={['auto', 'auto']} tick={{ fontSize: 12 }} tickFormatter={(value: number) => `${value}%`} />
            <YAxis yAxisId="mass" orientation="right" width={52} domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip weightDisplayUnit={weightDisplayUnit} showRiskInsights={false} />} />
            <Legend content={() => (
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-2 text-sm">
                {[
                  { key: 'weight', name: 'Body Weight', color: '#3b82f6' },
                  { key: 'muscleMass', name: 'Muscle Mass', color: '#16a34a' },
                  { key: 'averageBodyFatPercentage', name: 'Body Fat - Average', color: '#0891b2' },
                  { key: 'bodyFatPercentage', name: 'Body Fat - Logged', color: '#06b6d4' },
                  ...(hasEstimatedBodyFat ? [{ key: 'estimatedBodyFatPercentage', name: 'Body Fat - Estimated (RFM)', color: '#d97706' }] : []),
                ].map((series) => (
                  <button key={series.key} type="button" aria-pressed={!hiddenSeries.includes(series.key)}
                    onClick={() => setHiddenSeries((hidden) => hidden.includes(series.key)
                      ? hidden.filter((key) => key !== series.key) : [...hidden, series.key])}
                    className="flex min-h-8 items-center gap-2 rounded-sm px-1 focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ opacity: hiddenSeries.includes(series.key) ? 0.5 : 1 }}>
                    <span className="w-4 border-t-2" style={{ borderColor: series.color }} />
                    {series.name}
                  </button>
                ))}
              </div>
            )} />
            {generateRiskZones(chartData).map((zone, index) => (
              <ReferenceArea key={`risk-zone-${index}`} yAxisId="mass" x1={zone.x1} x2={zone.x2}
                fill={getRiskLevelColor(zone.level === 'low' ? 0 : zone.level === 'moderate' ? 0.5 : 1)} fillOpacity={0.12} />
            ))}
            <Line yAxisId="percentage" type="linear" dataKey="averageBodyFatPercentage"
              stroke="#0891b2" strokeWidth={3} name="Body Fat - Average"
              hide={hiddenSeries.includes('averageBodyFatPercentage')} connectNulls dot={{ r: 4 }} />
            <Line
              yAxisId="percentage"
              type="linear"
              dataKey="bodyFatPercentage"
              hide={hiddenSeries.includes('bodyFatPercentage')}
              stroke="#06b6d4"
              strokeWidth={2}
              name="Body Fat - Logged"
              connectNulls
              dot={{ r: 4 }}
            />
            {hasEstimatedBodyFat && (
              <Line
                yAxisId="percentage"
                type="linear"
                dataKey="estimatedBodyFatPercentage"
                hide={hiddenSeries.includes('estimatedBodyFatPercentage')}
                stroke="#d97706"
                strokeWidth={2}
                strokeDasharray="6 4"
                name="Body Fat - Estimated (RFM)"
                connectNulls
                dot={{ r: 4 }}
              />
            )}
            <Line
              yAxisId="mass"
              type="linear"
              dataKey="muscleMass"
              hide={hiddenSeries.includes('muscleMass')}
              stroke="#16a34a"
              strokeWidth={2}
              name="Muscle Mass"
              connectNulls
              dot={{ r: 4 }}
            />
            <Line
              yAxisId="mass"
              type="linear"
              dataKey="weight"
              hide={hiddenSeries.includes('weight')}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="5 3"
              name="Body Weight"
              connectNulls
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        {profile?.biological_sex && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Adult body-fat reference ({profile.biological_sex === 'male' ? 'men' : 'women'}):{' '}
            {profile.biological_sex === 'male' ? '18-24%' : '25-31%'}. Not a population average or a diagnosis.
          </p>
        )}
          </>
        )}
      </section>
    </div>
  );
}

export default memo(HealthMetricsChart);
