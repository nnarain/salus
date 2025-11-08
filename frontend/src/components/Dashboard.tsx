import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { biometricsApi, mealsApi } from '../services/api';
import { Biometric, CalorieStats } from '../types';
import { format } from 'date-fns';

function Dashboard() {
  const [biometrics, setBiometrics] = useState<Biometric[]>([]);
  const [calorieStats, setCalorieStats] = useState<CalorieStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const [biometricsRes, caloriesRes] = await Promise.all([
        biometricsApi.getAll(startDate, endDate),
        mealsApi.getStats(startDate, endDate),
      ]);

      setBiometrics(biometricsRes.data);
      setCalorieStats(caloriesRes.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  const weightData = biometrics
    .filter((b) => b.weight)
    .map((b) => ({
      date: format(new Date(b.date), 'MM/dd'),
      weight: b.weight,
    }))
    .reverse();

  const bmiData = biometrics
    .filter((b) => b.bmi)
    .map((b) => ({
      date: format(new Date(b.date), 'MM/dd'),
      bmi: b.bmi,
    }))
    .reverse();

  const calorieData = calorieStats
    .map((c) => ({
      date: format(new Date(c.date), 'MM/dd'),
      calories: c.total_calories,
      protein: c.total_protein,
      carbs: c.total_carbs,
      fat: c.total_fat,
    }))
    .reverse();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
        <p className="text-gray-600 mb-8">Track your health metrics over the last 30 days</p>
      </div>

      {/* Weight Chart */}
      {weightData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weight Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weightData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* BMI Chart */}
      {bmiData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">BMI Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={bmiData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="bmi" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Calorie Chart */}
      {calorieData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Calorie Intake</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={calorieData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="calories" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Macros Chart */}
      {calorieData.length > 0 && calorieData.some(d => d.protein || d.carbs || d.fat) && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Macronutrients</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={calorieData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="protein" fill="#ef4444" />
              <Bar dataKey="carbs" fill="#f59e0b" />
              <Bar dataKey="fat" fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {biometrics.length === 0 && calorieStats.length === 0 && (
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <p className="text-gray-600">No data available yet. Start by adding some biometrics or meal entries!</p>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
