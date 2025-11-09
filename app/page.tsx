"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import BiometricForm from '@/components/BiometricForm';

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
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Health Tracker
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Self-hosted personal health tracker built with Next.js 15, Supabase, Tailwind CSS, and Recharts
          </p>
        </div>

        {/* Technology Stack Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Next.js 15</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Latest React framework with App Router
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-3">🗄️</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Supabase</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Open source Firebase alternative
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-3">🎨</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Tailwind CSS</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Utility-first CSS framework
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Recharts</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Composable charting library
            </p>
          </div>
        </div>

        {/* Biometric Data Entry Form */}
        <div className="mb-12">
          <BiometricForm />
        </div>

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
