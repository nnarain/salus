"use client";

import { useState, useEffect, useMemo } from 'react';
import BiometricForm from '@/components/BiometricForm';
import ActivityForm from '@/components/ActivityForm';
import UserProfileForm from '@/components/UserProfileForm';
import StressForm from '@/components/StressForm';
import SleepForm from '@/components/SleepForm';
import NutritionForm from '@/components/NutritionForm';
import NutritionChart from '@/components/NutritionChart';
import CsvImportForm from '@/components/CsvImportForm';
import CsvExportForm from '@/components/CsvExportForm';
import Modal from '@/components/Modal';
import StatCard from '@/components/StatCard';
import WaistHeightInfoModal from '@/components/WaistHeightInfoModal';
import BodyFatInfoModal from '@/components/BodyFatInfoModal';
import HealthMetricsChart from '@/components/HealthMetricsChart';
import WeeklyActivityChart from '@/components/WeeklyActivityChart';
import WeeklyStressChart from '@/components/WeeklyStressChart';
import SleepDurationChart from '@/components/SleepDurationChart';
import CalorieWeightInsightChart from '@/components/CalorieWeightInsightChart';
import SleepStressInsightChart from '@/components/SleepStressInsightChart';
import WeightStressInsightChart from '@/components/WeightStressInsightChart';
import type { ActivityEntry, BiometricEntry, BodyFatEstimate, NutritionEntry, SleepEntry, StressEntry, UserProfile } from '@/lib/types';
import { kilogramsToPounds, poundsToKilograms } from '@/lib/weight';
import { getMaintenanceEstimate } from '@/lib/calorieEstimate';
import { estimateProteinTargetGrams } from '@/lib/nutritionGoals';
import {
  CALORIE_BALANCE_TOLERANCE_KCAL,
  createSampleThirtyDayWeightTrend,
  getCalorieBalanceTone,
  getSevenDayCalorieSummary,
  getThirtyDayWeightTrend,
  getWeightTrendTone,
} from '@/lib/dashboardMetrics';
import { calculateHealthRiskIndicator } from '@/lib/healthRisk';

const SUMMARY_TONE_STYLES = {
  green: { value: 'text-green-700 dark:text-green-400', description: 'text-xs text-green-700 dark:text-green-400 mt-1', border: 'border-green-200 dark:border-green-700' },
  blue: { value: 'text-blue-700 dark:text-blue-400', description: 'text-xs text-gray-500 dark:text-gray-400 mt-1', border: 'border-blue-200 dark:border-blue-700' },
  yellow: { value: 'text-amber-700 dark:text-amber-400', description: 'text-xs text-amber-700 dark:text-amber-400 mt-1', border: 'border-yellow-200 dark:border-yellow-700' },
  red: { value: 'text-red-700 dark:text-red-400', description: 'text-xs text-red-700 dark:text-red-400 mt-1', border: 'border-red-200 dark:border-red-700' },
};

// Helper function to determine waist-to-height ratio border color
function getWaistHeightBorderColor(ratio: number | null): string {
  if (ratio === null) return 'border-blue-200 dark:border-blue-700';
  if (ratio < 0.40) return 'border-green-200 dark:border-green-700';
  if (ratio < 0.50) return 'border-green-300 dark:border-green-600';
  if (ratio < 0.60) return 'border-yellow-200 dark:border-yellow-700';
  return 'border-red-200 dark:border-red-700';
}

// Helper function to determine body fat percentage border color
function getBodyFatBorderColor(percentage: number | null, sex?: UserProfile['biological_sex']): string {
  if (percentage === null || !sex) return 'border-blue-200 dark:border-blue-700';
  const thresholds = sex === 'male' ? [6, 14, 18, 25] : [14, 21, 25, 32];
  // Essential fat range
  if (percentage < thresholds[0]) return 'border-blue-200 dark:border-blue-700';
  // Athletic/Fitness range
  if (percentage < thresholds[1]) return 'border-green-200 dark:border-green-700';
  if (percentage < thresholds[2]) return 'border-green-300 dark:border-green-600';
  // Average/Acceptable range
  if (percentage < thresholds[3]) return 'border-yellow-200 dark:border-yellow-700';
  // Obese range
  return 'border-orange-200 dark:border-orange-700';
}

export default function Home() {
  const [dashboardView, setDashboardView] = useState<'data' | 'insights'>('data');
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isStressModalOpen, setIsStressModalOpen] = useState(false);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [isNutritionModalOpen, setIsNutritionModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isWaistHeightInfoModalOpen, setIsWaistHeightInfoModalOpen] = useState(false);
  const [isBodyFatInfoModalOpen, setIsBodyFatInfoModalOpen] = useState(false);
  const [isCalorieEstimateInfoModalOpen, setIsCalorieEstimateInfoModalOpen] = useState(false);
  const [lowestWeight, setLowestWeight] = useState<number | null>(null);
  const [waistHeightRatio, setWaistHeightRatio] = useState<number | null>(null);
  const [bodyFatPercentage, setBodyFatPercentage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometrics, setBiometrics] = useState<BiometricEntry[]>([]);
  const [bodyFatEstimates, setBodyFatEstimates] = useState<BodyFatEstimate[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[] | null>(null);
  const [stressEntries, setStressEntries] = useState<StressEntry[] | null>(null);
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[] | null>(null);
  const [nutritionEntries, setNutritionEntries] = useState<NutritionEntry[] | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const latestBodyFatEstimate = bodyFatEstimates
    .slice().sort((first, second) => second.date.localeCompare(first.date))[0];
  const latestBodyFatEntry = biometrics
    .filter((entry) => entry.metric_type === 'body_fat_percentage')
    .sort((first, second) => second.date.localeCompare(first.date))[0];
  const bodyFatReference = profile?.biological_sex === 'male' ? 'Reference: 18-24%'
    : profile?.biological_sex === 'female' ? 'Reference: 25-31%' : null;
  const [defaultChartRangeYears, setDefaultChartRangeYears] = useState<number | 'all'>(2);
  const [activeChartRangeYears, setActiveChartRangeYears] = useState<number | 'all'>(2);
  const [weightDisplayUnit, setWeightDisplayUnit] = useState<'kg' | 'lbs'>('kg');
  const calorieEstimate = useMemo(() => getMaintenanceEstimate(profile ?? {}, nutritionEntries ?? [], biometrics),
    [profile, nutritionEntries, biometrics]);
  const latestWeightEntry = useMemo(() => biometrics
    .filter((entry) => entry.metric_type === 'weight' && entry.value > 0)
    .sort((first, second) => second.date.localeCompare(first.date))[0], [biometrics]);
  const latestVisceralFat = biometrics
    .filter((entry) => entry.metric_type === 'visceral_fat_level' && Number.isFinite(entry.value) && entry.value >= 0)
    .sort((first, second) => second.date.localeCompare(first.date)
      || (second.created_at ?? '').localeCompare(first.created_at ?? ''))[0];
  const proteinTargetGrams = latestWeightEntry && (profile?.age === undefined || profile.age >= 18)
    ? estimateProteinTargetGrams(latestWeightEntry.unit === 'lbs'
      ? poundsToKilograms(latestWeightEntry.value)
      : latestWeightEntry.value)
    : undefined;
  const sevenDayCalories = useMemo(() => getSevenDayCalorieSummary(nutritionEntries ?? []), [nutritionEntries]);
  const actualThirtyDayWeightTrend = useMemo(() => getThirtyDayWeightTrend(biometrics), [biometrics]);
  const hasSampleWeightTrend = actualThirtyDayWeightTrend.currentDaysLogged === 0
    && actualThirtyDayWeightTrend.previousDaysLogged === 0;
  const thirtyDayWeightTrend = hasSampleWeightTrend
    ? createSampleThirtyDayWeightTrend()
    : actualThirtyDayWeightTrend;
  const currentHealthRisk = calculateHealthRiskIndicator(
    bodyFatPercentage ?? undefined,
    waistHeightRatio ?? undefined,
  );
  const hasWeightRecord = biometrics.some((entry) => entry.metric_type === 'weight');
  const missingCalorieInputs = [
    profile?.age === undefined ? 'age' : profile.age < 18 ? 'adult age' : null,
    !profile?.height || !profile.height_unit ? 'height' : null,
    !profile?.biological_sex ? 'formula coefficient' : null,
    !profile?.activity_level ? 'activity level' : null,
    !hasWeightRecord ? 'weight entry' : null,
  ].filter((input): input is string => input !== null);
  const calorieEstimateUnavailableDescription = profile?.age !== undefined && profile.age < 18
    ? 'An adult formula estimate is not applied under age 18.'
    : missingCalorieInputs.length > 0
      ? `Set ${missingCalorieInputs.join(', ')} in User Settings to calculate a formula estimate.`
      : 'Keep logging calories and weight to build a trend estimate.';
  const estimatedDailyBalance = calorieEstimate && sevenDayCalories.daysLogged >= 5 && sevenDayCalories.averageIntakeKcal !== undefined
    ? calorieEstimate.caloriesKcal - sevenDayCalories.averageIntakeKcal
    : null;
  const calorieBalanceDescription = sevenDayCalories.daysLogged === 0
    ? 'No calorie entries in the last 7 days'
    : sevenDayCalories.daysLogged < 5
      ? `${sevenDayCalories.daysLogged}/7 days logged · need at least 5 days to estimate balance`
      : estimatedDailyBalance === null
        ? `${sevenDayCalories.daysLogged}/7 days logged · maintenance estimate unavailable`
        : `${sevenDayCalories.daysLogged}/7 days logged${profile?.daily_calorie_target ? ` · target ${profile.daily_calorie_target} kcal/day` : ''}`;
  const calorieBalanceTone = getCalorieBalanceTone(estimatedDailyBalance);
  const calorieBalanceLabel = estimatedDailyBalance === null
    ? 'Balance unavailable'
    : Math.abs(estimatedDailyBalance) <= CALORIE_BALANCE_TOLERANCE_KCAL
      ? 'Near maintenance'
      : estimatedDailyBalance > 0 ? 'Estimated deficit' : 'Estimated surplus';
  const weightTrendTone = getWeightTrendTone(thirtyDayWeightTrend.differenceKg, currentHealthRisk);
  const riskContext = currentHealthRisk === null
    ? 'health risk context unavailable'
    : currentHealthRisk < 0.33
      ? 'low-risk context'
      : currentHealthRisk < 0.67
        ? 'moderate-risk context'
        : 'higher-risk context';
  const weightTrendDescription = thirtyDayWeightTrend.differenceKg === undefined
    ? `${hasSampleWeightTrend ? 'Sample preview · ' : ''}Weigh-ins: ${thirtyDayWeightTrend.currentDaysLogged}/30 days this period, ${thirtyDayWeightTrend.previousDaysLogged}/30 prior · need 2 in each`
    : `${hasSampleWeightTrend ? 'Sample preview · ' : ''}${thirtyDayWeightTrend.differenceKg < 0 ? 'Down' : thirtyDayWeightTrend.differenceKg > 0 ? 'Up' : 'Unchanged'} ${Math.abs(weightDisplayUnit === 'lbs'
      ? kilogramsToPounds(thirtyDayWeightTrend.differenceKg)
      : thirtyDayWeightTrend.differenceKg).toFixed(1)} ${weightDisplayUnit} vs prior 30 days · ${riskContext} · ${thirtyDayWeightTrend.currentDaysLogged}/30 weigh-in days${currentHealthRisk !== null && currentHealthRisk < 0.33 && thirtyDayWeightTrend.differenceKg > 0 ? ' · weight alone cannot confirm muscle gain' : ''}`;

  // Fetch biometrics and profile data
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch biometrics data
      const biometricsResponse = await fetch('/api/biometrics');
      const biometricsData = await biometricsResponse.json();
      setBodyFatEstimates(biometricsResponse.ok && Array.isArray(biometricsData.bodyFatEstimates)
        ? biometricsData.bodyFatEstimates : []);

      const activitiesResponse = await fetch('/api/activities');
      const activitiesData = await activitiesResponse.json();
      setActivities(activitiesResponse.ok && Array.isArray(activitiesData.data) ? activitiesData.data : null);

      const stressResponse = await fetch('/api/stress');
      const stressData = await stressResponse.json();
      setStressEntries(stressResponse.ok && Array.isArray(stressData.data) ? stressData.data : null);

      const sleepResponse = await fetch('/api/sleep');
      const sleepData = await sleepResponse.json();
      setSleepEntries(sleepResponse.ok && Array.isArray(sleepData.data) ? sleepData.data : null);

      const nutritionResponse = await fetch('/api/nutrition');
      const nutritionData = await nutritionResponse.json();
      setNutritionEntries(nutritionResponse.ok && Array.isArray(nutritionData.data) ? nutritionData.data : null);
      
      // Fetch profile data
        const profileResponse = await fetch('/api/profile');
        const profileData = await profileResponse.json();

        if (biometricsData.data && Array.isArray(biometricsData.data)) {
          const biometricsArray: BiometricEntry[] = biometricsData.data;
          setBiometrics(biometricsArray);
          
          // Calculate lowest weight in last 7 days
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          const recentWeights = biometricsArray.filter((entry) => {
            const entryDate = new Date(entry.date);
            return entry.metric_type === 'weight' && entryDate >= sevenDaysAgo;
          });

          if (recentWeights.length > 0) {
            // Convert all weights to kg for comparison
            const weightsInKg = recentWeights.map((entry) => {
              if (entry.unit === 'lbs') {
                return poundsToKilograms(entry.value);
              }
              return entry.value;
            });
            
            const minWeight = Math.min(...weightsInKg);
            setLowestWeight(minWeight);
          }
          else {
            // No weights in last 7 days, take the last recorded weight
            const allWeights = biometricsArray.filter((entry) => entry.metric_type === 'weight');
            if (allWeights.length > 0) {
              const latestWeightEntry = allWeights.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              let weightInKg = latestWeightEntry.value;
              if (latestWeightEntry.unit === 'lbs') {
                weightInKg = poundsToKilograms(latestWeightEntry.value);
              }
              setLowestWeight(weightInKg);
            } else {
              setLowestWeight(null);
            }
          }

          // Calculate waist-to-height ratio
          const profileData2: UserProfile | null = profileData.data;
          setProfile(profileData2);
          if (profileData2 && profileData2.height) {
            const latestWaist = biometricsArray.find((entry) => entry.metric_type === 'waistline');
            
            if (latestWaist) {
              // Convert height to cm
              let heightInCm = profileData2.height;
              if (profileData2.height_unit === 'inches') {
                heightInCm = profileData2.height * 2.54;
              } else if (profileData2.height_unit === 'feet') {
                heightInCm = profileData2.height * 30.48;
              }
              
              // Convert waist to cm
              let waistInCm = latestWaist.value;
              if (latestWaist.unit === 'inches') {
                waistInCm = latestWaist.value * 2.54;
              }
              
              // Calculate ratio
              const ratio = waistInCm / heightInCm;
              setWaistHeightRatio(ratio);
            }
          }

          // Get latest body fat percentage
          const latestBodyFat = biometricsArray
            .filter((entry) => entry.metric_type === 'body_fat_percentage')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          
          if (latestBodyFat) {
            setBodyFatPercentage(latestBodyFat.value);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const savedRange = window.localStorage.getItem('health-tracker-chart-range');
    const savedWeightUnit = window.localStorage.getItem('health-tracker-weight-display-unit');
    if (savedRange === 'all') {
      setDefaultChartRangeYears('all');
      setActiveChartRangeYears('all');
    } else if ([1, 2, 5].includes(Number(savedRange))) {
      const range = Number(savedRange);
      setDefaultChartRangeYears(range);
      setActiveChartRangeYears(range);
    }
    if (savedWeightUnit === 'kg' || savedWeightUnit === 'lbs') {
      setWeightDisplayUnit(savedWeightUnit);
    }
  }, []);

  const handleDefaultChartRangeChange = (range: number | 'all') => {
    setDefaultChartRangeYears(range);
    setActiveChartRangeYears(range);
    window.localStorage.setItem('health-tracker-chart-range', String(range));
  };

  const handleWeightDisplayUnitChange = (unit: 'kg' | 'lbs') => {
    setWeightDisplayUnit(unit);
    window.localStorage.setItem('health-tracker-weight-display-unit', unit);
  };

  const handleModalSuccess = () => {
    fetchData();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-16">
        {/* Settings and Import/Export Icons - Top Right */}
        <div className="absolute top-4 right-4 flex gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg hover:shadow-xl transition-all hover:bg-gray-50 dark:hover:bg-gray-700"
            aria-label="Import Data"
            title="Import CSV Data"
          >
            <svg
              className="w-6 h-6 text-gray-700 dark:text-gray-300"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg hover:shadow-xl transition-all hover:bg-gray-50 dark:hover:bg-gray-700"
            aria-label="Export Data"
            title="Export CSV Data"
          >
            <svg
              className="w-6 h-6 text-gray-700 dark:text-gray-300"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 11l3 3m0 0l3-3m-3 3V3"></path>
            </svg>
          </button>
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg hover:shadow-xl transition-all hover:bg-gray-50 dark:hover:bg-gray-700"
            aria-label="Personal Settings"
            title="Personal Settings"
          >
            <svg
              className="w-6 h-6 text-gray-700 dark:text-gray-300"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
            Salus
          </h1>
        </div>

        {/* Key Metrics Display */}
        <section aria-label="Key metrics" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <StatCard
            title="Visceral Fat Level"
            value={latestVisceralFat ? latestVisceralFat.value.toLocaleString() : 'N/A'}
            unit={latestVisceralFat ? 'level' : undefined}
            description={latestVisceralFat
              ? `Latest measurement · ${latestVisceralFat.scale_min != null && latestVisceralFat.scale_max != null
                ? `Device range ${latestVisceralFat.scale_min} to ${latestVisceralFat.scale_max}`
                : 'Device range not recorded'}`
              : 'Add a visceral fat measurement'}
            loading={loading}
          />
          <StatCard
            title="Waist to Height Ratio"
            value={waistHeightRatio !== null ? waistHeightRatio.toFixed(3) : 'N/A'}
            description={
              waistHeightRatio !== null
                ? waistHeightRatio < 0.5
                  ? 'Healthy range'
                  : waistHeightRatio < 0.6
                  ? 'Increased health risk'
                  : 'High health risk'
                : 'Add waist measurement and height to calculate'
            }
            loading={loading}
            onInfoClick={() => setIsWaistHeightInfoModalOpen(true)}
            borderColor={getWaistHeightBorderColor(waistHeightRatio)}
            icon={
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
            }
          />
          <StatCard
            title="Body Fat Percentage"
            value={bodyFatPercentage !== null ? bodyFatPercentage.toFixed(1) : 'N/A'}
            unit={bodyFatPercentage !== null ? '%' : undefined}
            description={
              bodyFatPercentage !== null
                ? [latestBodyFatEntry?.date, bodyFatReference].filter(Boolean).join(' · ')
                : 'Add body fat percentage measurement'
            }
            loading={loading}
            onInfoClick={() => setIsBodyFatInfoModalOpen(true)}
            borderColor={getBodyFatBorderColor(bodyFatPercentage, profile?.biological_sex)}
            icon={
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
            }
          >
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {latestBodyFatEstimate
                ? `RFM estimate: ${latestBodyFatEstimate.percentage.toFixed(1)}% (${latestBodyFatEstimate.date})`
                : 'RFM estimate unavailable'}
            </p>
          </StatCard>
          <StatCard
            title="Lowest Weight (Last 7 Days)"
            value={lowestWeight !== null
              ? (weightDisplayUnit === 'lbs' ? kilogramsToPounds(lowestWeight) : lowestWeight).toFixed(1)
              : 'N/A'}
            unit={lowestWeight !== null ? weightDisplayUnit : undefined}
            description="Minimum weight recorded in the past week"
            loading={loading}
            icon={
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path>
              </svg>
            }
          />
          <StatCard
            title="Calorie Balance (7-Day Avg)"
            value={estimatedDailyBalance !== null ? `~${Math.abs(estimatedDailyBalance).toLocaleString()}` : 'N/A'}
            unit={estimatedDailyBalance !== null ? 'kcal/day' : undefined}
            valueColor={SUMMARY_TONE_STYLES[calorieBalanceTone].value}
            description={`${calorieEstimate
              ? calorieEstimate.source === 'logged_data'
                ? `Trend estimate · ${calorieEstimate.daysCovered} days of data`
                : `Formula estimate · latest weight ${calorieEstimate.weightDate
                  ? new Date(`${calorieEstimate.weightDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'recorded'}`
              : calorieEstimateUnavailableDescription} · ${calorieBalanceDescription}`}
            borderColor={SUMMARY_TONE_STYLES[calorieBalanceTone].border}
            loading={loading}
            onInfoClick={() => setIsCalorieEstimateInfoModalOpen(true)}
          >
            <p className={`mt-1 text-sm font-medium ${SUMMARY_TONE_STYLES[calorieBalanceTone].value}`}>
              {calorieBalanceLabel}
            </p>
            <dl className="mb-3 mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
              <div className="min-w-0">
                <dt className="text-xs text-gray-600 dark:text-gray-400">Average intake (7 days)</dt>
                <dd className="mt-1 break-words text-2xl font-semibold text-gray-900 dark:text-white">
                  {sevenDayCalories.averageIntakeKcal?.toLocaleString() ?? 'N/A'}
                  {sevenDayCalories.averageIntakeKcal !== undefined && (
                    <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">kcal/day</span>
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-gray-600 dark:text-gray-400">Maintenance (TDEE)</dt>
                <dd className="mt-1 break-words text-2xl font-semibold text-gray-900 dark:text-white">
                  {calorieEstimate?.caloriesKcal.toLocaleString() ?? 'N/A'}
                  {calorieEstimate && (
                    <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">kcal/day</span>
                  )}
                </dd>
              </div>
            </dl>
          </StatCard>
          <StatCard
            title="Weight Trend (30-Day Avg)"
            value={thirtyDayWeightTrend.currentAverageKg !== undefined
              ? (weightDisplayUnit === 'lbs'
                ? kilogramsToPounds(thirtyDayWeightTrend.currentAverageKg)
                : thirtyDayWeightTrend.currentAverageKg).toFixed(1)
              : 'N/A'}
            unit={thirtyDayWeightTrend.currentAverageKg !== undefined ? weightDisplayUnit : undefined}
            description={weightTrendDescription}
            descriptionColor={SUMMARY_TONE_STYLES[weightTrendTone].description}
            borderColor={SUMMARY_TONE_STYLES[weightTrendTone].border}
            loading={loading}
            icon={
              <svg className="h-6 w-6 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M7 15l4-4 3 3 5-7" />
              </svg>
            }
          />
        </section>

        {/* Action Buttons for Forms */}
        <div className="flex flex-wrap gap-4 justify-center mb-12">
          <button
            onClick={() => setIsBiometricModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-8 rounded-lg shadow-lg transition-all hover:shadow-xl flex items-center gap-3"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
            </svg>
            Add Biometric Data
          </button>

          <button
            onClick={() => setIsNutritionModalOpen(true)}
            className="flex items-center gap-3 rounded-lg bg-lime-600 px-8 py-4 font-semibold text-white shadow-lg transition-all hover:bg-lime-700 hover:shadow-xl"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3m14.5-6.5-11 13m0-13 11 13" />
            </svg>
            Add Nutrition Data
          </button>

          <button
            onClick={() => setIsActivityModalOpen(true)}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-4 px-8 rounded-lg shadow-lg transition-all hover:shadow-xl flex items-center gap-3"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
            Add Activity
          </button>

          <button
            onClick={() => setIsStressModalOpen(true)}
            className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-4 px-8 rounded-lg shadow-lg transition-all hover:shadow-xl flex items-center gap-3"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            Add Stress Level
          </button>

          <button
            onClick={() => setIsSleepModalOpen(true)}
            className="flex items-center gap-3 rounded-lg bg-teal-600 px-8 py-4 font-semibold text-white shadow-lg transition-all hover:bg-teal-700 hover:shadow-xl"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.985 12.486a9 9 0 11-9.473-9.472c.405-.022.617.463.402.807a6.5 6.5 0 008.268 8.268c.344-.215.829-.003.803.397z" />
            </svg>
            Add Sleep Data
          </button>

        </div>

        {/* Modals */}
        <Modal
          isOpen={isBiometricModalOpen}
          onClose={() => setIsBiometricModalOpen(false)}
          title="Add Biometric Data"
        >
          <BiometricForm onSuccess={() => { setIsBiometricModalOpen(false); handleModalSuccess(); }} />
        </Modal>

        <Modal
          isOpen={isActivityModalOpen}
          onClose={() => setIsActivityModalOpen(false)}
          title="Add Activity"
        >
          <ActivityForm onSuccess={() => { setIsActivityModalOpen(false); handleModalSuccess(); }} />
        </Modal>

        <Modal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            title="Personal Settings"
          >
          <UserProfileForm
            chartRangeYears={defaultChartRangeYears}
            onChartRangeChange={handleDefaultChartRangeChange}
            weightDisplayUnit={weightDisplayUnit}
            onWeightDisplayUnitChange={handleWeightDisplayUnitChange}
            onSuccess={() => { setIsProfileModalOpen(false); handleModalSuccess(); }}
          />
        </Modal>

        <Modal
          isOpen={isStressModalOpen}
          onClose={() => setIsStressModalOpen(false)}
          title="Add Stress Level"
        >
          <StressForm onSuccess={() => { setIsStressModalOpen(false); handleModalSuccess(); }} />
        </Modal>

        <Modal
          isOpen={isSleepModalOpen}
          onClose={() => setIsSleepModalOpen(false)}
          title="Add Sleep Data"
        >
          <SleepForm onSuccess={() => { setIsSleepModalOpen(false); handleModalSuccess(); }} />
        </Modal>

        <Modal
          isOpen={isNutritionModalOpen}
          onClose={() => setIsNutritionModalOpen(false)}
          title="Add Daily Nutrition"
        >
          <NutritionForm onSuccess={() => setIsNutritionModalOpen(false)} />
        </Modal>

        <Modal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          title="Import CSV Data"
        >
          <CsvImportForm onSuccess={() => { 
            handleModalSuccess(); 
            setTimeout(() => setIsImportModalOpen(false), 1500);
          }} />
        </Modal>

        <Modal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          title="Export CSV Data"
        >
          <CsvExportForm />
        </Modal>

        <WaistHeightInfoModal
          isOpen={isWaistHeightInfoModalOpen}
          onClose={() => setIsWaistHeightInfoModalOpen(false)}
        />

        <BodyFatInfoModal
          isOpen={isBodyFatInfoModalOpen}
          onClose={() => setIsBodyFatInfoModalOpen(false)}
        />

        <Modal
          isOpen={isCalorieEstimateInfoModalOpen}
          onClose={() => setIsCalorieEstimateInfoModalOpen(false)}
          title="Calorie Balance & Maintenance"
        >
          <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300">
            <section>
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">Estimated daily balance</h3>
              <p>
                Estimated maintenance minus average intake over the last seven days gives the estimated daily deficit or surplus. At least five logged days are needed; missing days are not counted as zero intake.
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>Blue: within {CALORIE_BALANCE_TOLERANCE_KCAL} kcal/day of maintenance, or balance unavailable.</li>
                <li>Green: deficit over {CALORIE_BALANCE_TOLERANCE_KCAL} and up to 500 kcal/day.</li>
                <li>Amber: deficit over 500, or surplus over {CALORIE_BALANCE_TOLERANCE_KCAL} and up to 300 kcal/day.</li>
                <li>Red: surplus over 300 kcal/day.</li>
              </ul>
              <p className="mt-2 text-xs">These display bands are not personalized calorie recommendations.</p>
            </section>
            <section>
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">Initial formula estimate</h3>
              <p>
                Basal metabolic rate (BMR) uses the Mifflin–St Jeor formula, then multiplies by the selected activity level to estimate total daily energy expenditure (TDEE).
              </p>
              <p className="mt-2 rounded-md bg-gray-50 p-3 font-mono text-xs dark:bg-gray-700/50">
                BMR = 10 × weight (kg) + 6.25 × height (cm) − 5 × age + formula adjustment (+5 or −161)
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
                <li>Sedentary: 1.2</li>
                <li>Light: 1.375</li>
                <li>Moderate: 1.55</li>
                <li>Active: 1.725</li>
                <li>Very active: 1.9</li>
              </ul>
            </section>
            <section>
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">Estimate from your logged data</h3>
              <p>
                After at least 14 days with calorie intake logged on 70% of days and four or more weigh-ins spanning at least 14 days, Salus estimates maintenance from average intake and the weight trend. It uses an approximate 7,700 kcal per kilogram conversion, so short-term water changes and incomplete logging can affect it.
              </p>
            </section>
            <p className="rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-700/50">
              Both methods are estimates, not measurements or medical advice. Your daily calorie target is a separate setting and does not change the maintenance estimate.
            </p>
          </div>
        </Modal>

        {/* Health Metrics Chart */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-800" role="group" aria-label="Dashboard view">
            <button
              type="button"
              aria-pressed={dashboardView === 'data'}
              onClick={() => setDashboardView('data')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${dashboardView === 'data'
                ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/60'}`}
            >
              Data
            </button>
            <button
              type="button"
              aria-pressed={dashboardView === 'insights'}
              onClick={() => setDashboardView('insights')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${dashboardView === 'insights'
                ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/60'}`}
            >
              Insights
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="dashboard-range" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Date range
            </label>
            <select
              id="dashboard-range"
              value={activeChartRangeYears}
              onChange={(event) => setActiveChartRangeYears(event.target.value === 'all' ? 'all' : Number(event.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value={1}>Last year</option>
              <option value={2}>Last 2 years</option>
              <option value={5}>Last 5 years</option>
              <option value="all">All available data</option>
            </select>
          </div>
        </div>

        {dashboardView === 'data' ? (
          <>
            <HealthMetricsChart
              biometrics={biometrics}
              bodyFatEstimates={bodyFatEstimates}
              profile={profile}
              rangeYears={activeChartRangeYears}
              weightDisplayUnit={weightDisplayUnit}
            />
            <div className="mt-6">
              <NutritionChart
                entries={nutritionEntries}
                rangeYears={activeChartRangeYears}
                loading={loading}
                maintenanceEstimate={calorieEstimate}
                dailyCalorieTarget={profile?.daily_calorie_target}
                proteinTargetGrams={proteinTargetGrams}
                proteinTargetWeightDate={latestWeightEntry?.date}
              />
            </div>
            <div className="mt-6">
              <WeeklyActivityChart activities={activities} rangeYears={activeChartRangeYears} loading={loading} />
            </div>
            <div className="mt-6">
              <WeeklyStressChart entries={stressEntries} rangeYears={activeChartRangeYears} loading={loading} />
            </div>
            <div className="mt-6">
              <SleepDurationChart entries={sleepEntries} rangeYears={activeChartRangeYears} age={profile?.age} loading={loading} />
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <CalorieWeightInsightChart
              nutritionEntries={nutritionEntries}
              biometrics={biometrics}
              profile={profile}
              rangeYears={activeChartRangeYears}
              weightDisplayUnit={weightDisplayUnit}
              loading={loading}
            />
            <WeightStressInsightChart
              biometrics={biometrics}
              stressEntries={stressEntries}
              rangeYears={activeChartRangeYears}
              weightDisplayUnit={weightDisplayUnit}
              loading={loading}
            />
            <SleepStressInsightChart
              sleepEntries={sleepEntries}
              stressEntries={stressEntries}
              rangeYears={activeChartRangeYears}
              age={profile?.age}
            />
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-gray-600 dark:text-gray-400">
            Hello World! 🌍 This is a basic foundation ready for further development.
          </p>
        </div>
      </main>
    </div>
  );
}
