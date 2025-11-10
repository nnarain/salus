"use client";

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import BiometricForm from '@/components/BiometricForm';
import ActivityForm from '@/components/ActivityForm';
import UserProfileForm from '@/components/UserProfileForm';
import StressForm from '@/components/StressForm';
import Modal from '@/components/Modal';
import StatCard from '@/components/StatCard';
import WaistHeightInfoModal from '@/components/WaistHeightInfoModal';
import type { BiometricEntry, UserProfile } from '@/lib/types';

// Sample data for the chart
const sampleHealthData = [
  { date: 'Mon', steps: 8000, calories: 2100 },
  { date: 'Tue', steps: 9500, calories: 2300 },
  { date: 'Wed', steps: 7200, calories: 2000 },
  { date: 'Thu', steps: 10500, calories: 2400 },
  { date: 'Fri', steps: 8800, calories: 2200 },
  { date: 'Sat', steps: 12000, calories: 2600 },
  { date: 'Sun', steps: 6500, calories: 1900 },
];

export default function Home() {
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isStressModalOpen, setIsStressModalOpen] = useState(false);
  const [isWaistHeightInfoModalOpen, setIsWaistHeightInfoModalOpen] = useState(false);
  const [lowestWeight, setLowestWeight] = useState<number | null>(null);
  const [lowestWeightUnit, setLowestWeightUnit] = useState<string>('kg');
  const [waistHeightRatio, setWaistHeightRatio] = useState<number | null>(null);
  const [bodyFatPercentage, setBodyFatPercentage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch biometrics and profile data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch biometrics data
        const biometricsResponse = await fetch('/api/biometrics');
        const biometricsData = await biometricsResponse.json();
        
        // Fetch profile data
        const profileResponse = await fetch('/api/profile');
        const profileData = await profileResponse.json();

        if (biometricsData.data && Array.isArray(biometricsData.data)) {
          const biometrics: BiometricEntry[] = biometricsData.data;
          
          // Calculate lowest weight in last 7 days
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          const recentWeights = biometrics.filter((entry) => {
            const entryDate = new Date(entry.date);
            return entry.metric_type === 'weight' && entryDate >= sevenDaysAgo;
          });

          if (recentWeights.length > 0) {
            // Convert all weights to kg for comparison
            const weightsInKg = recentWeights.map((entry) => {
              if (entry.unit === 'lbs') {
                return entry.value * 0.453592; // Convert lbs to kg
              }
              return entry.value;
            });
            
            const minWeight = Math.min(...weightsInKg);
            setLowestWeight(minWeight);
            setLowestWeightUnit('kg');
          }

          // Calculate waist-to-height ratio
          const profile: UserProfile | null = profileData.data;
          if (profile && profile.height) {
            const latestWaist = biometrics.find((entry) => entry.metric_type === 'waistline');
            
            if (latestWaist) {
              // Convert height to cm
              let heightInCm = profile.height;
              if (profile.height_unit === 'inches') {
                heightInCm = profile.height * 2.54;
              } else if (profile.height_unit === 'feet') {
                heightInCm = profile.height * 30.48;
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
          const latestBodyFat = biometrics
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

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-16">
        {/* Settings Icon - Top Right */}
        <div className="absolute top-4 right-4">
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
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Health Tracker
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Self-hosted personal health tracker built with Next.js 15, Supabase, Tailwind CSS, and Recharts
          </p>
        </div>

        {/* Key Metrics Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <StatCard
            title="Lowest Weight (Last 7 Days)"
            value={lowestWeight !== null ? lowestWeight.toFixed(1) : 'N/A'}
            unit={lowestWeight !== null ? lowestWeightUnit : undefined}
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
        </div>

        {/* Modals */}
        <Modal
          isOpen={isBiometricModalOpen}
          onClose={() => setIsBiometricModalOpen(false)}
          title="Add Biometric Data"
        >
          <BiometricForm onSuccess={() => setIsBiometricModalOpen(false)} />
        </Modal>

        <Modal
          isOpen={isActivityModalOpen}
          onClose={() => setIsActivityModalOpen(false)}
          title="Add Activity"
        >
          <ActivityForm onSuccess={() => setIsActivityModalOpen(false)} />
        </Modal>

        <Modal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          title="User Settings"
        >
          <UserProfileForm onSuccess={() => setIsProfileModalOpen(false)} />
        </Modal>

        <Modal
          isOpen={isStressModalOpen}
          onClose={() => setIsStressModalOpen(false)}
          title="Add Stress Level"
        >
          <StressForm onSuccess={() => setIsStressModalOpen(false)} />
        </Modal>

        <WaistHeightInfoModal
          isOpen={isWaistHeightInfoModalOpen}
          onClose={() => setIsWaistHeightInfoModalOpen(false)}
        />

        {/* Sample Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Weekly Health Metrics (Sample Data)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={sampleHealthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="steps" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="calories" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
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
