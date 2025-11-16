"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';
import type { BiometricEntry, UserProfile } from '@/lib/types';
import { calculateHealthRiskIndicator, getRiskLevelDescription, getRiskLevelColor } from '@/lib/healthRisk';

interface HealthMetricsChartProps {
  biometrics: BiometricEntry[];
  profile: UserProfile | null;
}

interface ChartDataPoint {
  date: string;
  weight?: number;
  waistHeightRatio?: number;
  bodyFatPercentage?: number;
  healthRisk?: number;
}

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
const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
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
          } else if (entry.dataKey === 'bodyFatPercentage' && entry.value) {
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
          }

          return (
            <p key={index} style={{ color }} className="text-sm">
              {entry.name}: {entry.value}
              {entry.dataKey === 'weight' && ' kg'}
              {entry.dataKey === 'bodyFatPercentage' && '%'}
              {entry.dataKey === 'healthRisk' && ` - ${(entry.value * 100).toFixed(0)}%`}
              <span className="font-semibold">{insight}</span>
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

// Helper function to get risk level category
const getRiskLevel = (riskScore: number | undefined): 'low' | 'moderate' | 'high' | null => {
  if (riskScore === undefined || riskScore === null) return null;
  if (riskScore < 0.33) return 'low';
  if (riskScore < 0.67) return 'moderate';
  return 'high';
};

// Helper function to generate risk zones for reference areas
interface RiskZone {
  x1: string;
  x2: string;
  level: 'low' | 'moderate' | 'high';
}

const generateRiskZones = (chartData: ChartDataPoint[]): RiskZone[] => {
  const zones: RiskZone[] = [];
  let currentZone: RiskZone | null = null;

  chartData.forEach((point, index) => {
    const riskLevel = getRiskLevel(point.healthRisk);
    
    if (!riskLevel) return;

    if (!currentZone || currentZone.level !== riskLevel) {
      // Start a new zone
      if (currentZone) {
        zones.push(currentZone);
      }
      currentZone = {
        x1: point.date,
        x2: point.date,
        level: riskLevel
      };
    } else {
      // Extend current zone
      currentZone.x2 = point.date;
    }

    // Push the last zone
    if (index === chartData.length - 1 && currentZone) {
      zones.push(currentZone);
    }
  });

  return zones;
};

// Process biometric data into chart format
const processChartData = (biometrics: BiometricEntry[], profile: UserProfile | null): ChartDataPoint[] => {
  const dataByDate = new Map<string, ChartDataPoint>();

  biometrics.forEach((entry) => {
    const date = entry.date;
    if (!dataByDate.has(date)) {
      dataByDate.set(date, { date });
    }
    const dataPoint = dataByDate.get(date)!;

    if (entry.metric_type === 'weight') {
      // Convert to kg for consistency
      let weightInKg = entry.value;
      if (entry.unit === 'lbs') {
        weightInKg = entry.value * 0.453592;
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
    }
  });

  // Convert to array and sort by date
  const chartData = Array.from(dataByDate.values()).sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Calculate health risk for each data point
  chartData.forEach((dataPoint) => {
    const healthRisk = calculateHealthRiskIndicator(
      dataPoint.bodyFatPercentage,
      dataPoint.waistHeightRatio
    );
    if (healthRisk !== null) {
      dataPoint.healthRisk = Number(healthRisk.toFixed(3));
    }
  });

  return chartData;
};

export default function HealthMetricsChart({ biometrics, profile }: HealthMetricsChartProps) {
  const chartData = processChartData(biometrics, profile);

  if (chartData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Weight & Health Risk Indicator
          </h2>
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              No data available yet. Start adding biometric measurements to see your progress!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weight and Health Risk Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Weight & Health Risk Indicator
        </h2>
        <div className="mb-4">
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#8b5cf6' }}></div>
              <span>Weight (kg)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.5)' }}></div>
              <span>Low Risk Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)', border: '1px solid rgba(251, 191, 36, 0.5)' }}></div>
              <span>Moderate Risk Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)' }}></div>
              <span>High Risk Zone</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            <p>💡 Health Risk: Calculated from body fat % and waist-to-height ratio. Colored zones indicate risk level over time.</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {/* Render risk zones as colored overlays */}
            {generateRiskZones(chartData).map((zone, index) => {
              const fillColor = 
                zone.level === 'low' ? 'rgba(34, 197, 94, 0.15)' :
                zone.level === 'moderate' ? 'rgba(251, 191, 36, 0.15)' :
                'rgba(239, 68, 68, 0.15)';
              
              return (
                <ReferenceArea
                  key={`risk-zone-${index}`}
                  x1={zone.x1}
                  x2={zone.x2}
                  fill={fillColor}
                  fillOpacity={1}
                />
              );
            })}
            <Line 
              type="monotone" 
              dataKey="weight" 
              stroke="#8b5cf6" 
              strokeWidth={3} 
              name="Weight"
              connectNulls
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Body Composition Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Body Composition Metrics
        </h2>
        <div className="mb-4">
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ec4899' }}></div>
              <span>Waist-to-Height Ratio</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#06b6d4' }}></div>
              <span>Body Fat %</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            <p>💡 Waist-to-Height Ratio: &lt;0.5 Healthy, 0.5-0.6 Increased Risk, &gt;0.6 High Risk</p>
            <p>💡 Body Fat %: &lt;18 Athletic, 18-25 Fitness, 25-32 Average, &gt;32 High</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="waistHeightRatio" 
              stroke="#ec4899" 
              strokeWidth={2} 
              name="Waist-to-Height Ratio"
              connectNulls
              dot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="bodyFatPercentage" 
              stroke="#06b6d4" 
              strokeWidth={2} 
              name="Body Fat %"
              connectNulls
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
