"use client";

import { useState, useEffect } from 'react';
import BiometricForm from '@/components/BiometricForm';
import ActivityForm from '@/components/ActivityForm';
import UserProfileForm from '@/components/UserProfileForm';
import StressForm from '@/components/StressForm';
import SleepForm from '@/components/SleepForm';
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
import type { ActivityEntry, BiometricEntry, SleepEntry, StressEntry, UserProfile } from '@/lib/types';
import { kilogramsToPounds, poundsToKilograms } from '@/lib/weight';

// Helper function to determine waist-to-height ratio border color
function getWaistHeightBorderColor(ratio: number | null): string {
  if (ratio === null) return 'border-blue-200 dark:border-blue-700';
  if (ratio < 0.40) return 'border-green-200 dark:border-green-700';
  if (ratio < 0.50) return 'border-green-300 dark:border-green-600';
  if (ratio < 0.60) return 'border-yellow-200 dark:border-yellow-700';
  return 'border-red-200 dark:border-red-700';
}

// Helper function to determine body fat percentage border color
// For simplicity, using general ranges (can be refined based on gender if needed)
function getBodyFatBorderColor(percentage: number | null): string {
  if (percentage === null) return 'border-blue-200 dark:border-blue-700';
  // Essential fat range
  if (percentage < 14) return 'border-blue-200 dark:border-blue-700';
  // Athletic/Fitness range
  if (percentage < 18) return 'border-green-200 dark:border-green-700';
  if (percentage < 25) return 'border-green-300 dark:border-green-600';
  // Average/Acceptable range
  if (percentage < 32) return 'border-yellow-200 dark:border-yellow-700';
  // Obese range
  return 'border-orange-200 dark:border-orange-700';
}

export default function Home() {
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isStressModalOpen, setIsStressModalOpen] = useState(false);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isWaistHeightInfoModalOpen, setIsWaistHeightInfoModalOpen] = useState(false);
  const [isBodyFatInfoModalOpen, setIsBodyFatInfoModalOpen] = useState(false);
  const [lowestWeight, setLowestWeight] = useState<number | null>(null);
  const [waistHeightRatio, setWaistHeightRatio] = useState<number | null>(null);
  const [bodyFatPercentage, setBodyFatPercentage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometrics, setBiometrics] = useState<BiometricEntry[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[] | null>(null);
  const [stressEntries, setStressEntries] = useState<StressEntry[] | null>(null);
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[] | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [defaultChartRangeYears, setDefaultChartRangeYears] = useState<number | 'all'>(2);
  const [activeChartRangeYears, setActiveChartRangeYears] = useState<number | 'all'>(2);
  const [weightDisplayUnit, setWeightDisplayUnit] = useState<'kg' | 'lbs'>('kg');

  // Fetch biometrics and profile data
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch biometrics data
      const biometricsResponse = await fetch('/api/biometrics');
      const biometricsData = await biometricsResponse.json();

      const activitiesResponse = await fetch('/api/activities');
      const activitiesData = await activitiesResponse.json();
      setActivities(activitiesResponse.ok && Array.isArray(activitiesData.data) ? activitiesData.data : null);

      const stressResponse = await fetch('/api/stress');
      const stressData = await stressResponse.json();
      setStressEntries(stressResponse.ok && Array.isArray(stressData.data) ? stressData.data : null);

      const sleepResponse = await fetch('/api/sleep');
      const sleepData = await sleepResponse.json();
      setSleepEntries(sleepResponse.ok && Array.isArray(sleepData.data) ? sleepData.data : null);
      
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
            aria-label="User Settings"
            title="User Settings (Height & Age)"
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
            Health Tracker
          </h1>
        </div>

        {/* Key Metrics Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
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
                ? 'Latest measurement'
                : 'Add body fat percentage measurement'
            }
            loading={loading}
            onInfoClick={() => setIsBodyFatInfoModalOpen(true)}
            borderColor={getBodyFatBorderColor(bodyFatPercentage)}
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
          />
        </div>

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
          title="User Settings"
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

        {/* Health Metrics Chart */}
        <HealthMetricsChart
          biometrics={biometrics}
          profile={profile}
          rangeYears={activeChartRangeYears}
          onRangeChange={setActiveChartRangeYears}
          weightDisplayUnit={weightDisplayUnit}
        />
        <div className="mt-6">
          <WeeklyActivityChart
            activities={activities}
            rangeYears={activeChartRangeYears}
            loading={loading}
          />
        </div>
        <div className="mt-6">
          <WeeklyStressChart
            entries={stressEntries}
            rangeYears={activeChartRangeYears}
            loading={loading}
          />
        </div>
        <div className="mt-6">
          <SleepDurationChart
            entries={sleepEntries}
            rangeYears={activeChartRangeYears}
            age={profile?.age}
            loading={loading}
          />
        </div>

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
