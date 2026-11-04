"use client";

import { useState, useEffect } from 'react';
import type { UserProfile } from '@/lib/types';
import ChartRangeControl from '@/components/ChartRangeControl';

interface UserProfileFormProps {
  onSuccess?: () => void;
  chartRangeYears: number | 'all';
  onChartRangeChange: (range: number | 'all') => void;
  weightDisplayUnit: 'kg' | 'lbs';
  onWeightDisplayUnitChange: (unit: 'kg' | 'lbs') => void;
  loggingGapDays: number;
  onLoggingGapDaysChange: (days: number) => void;
}

export default function UserProfileForm({
  chartRangeYears,
  onChartRangeChange,
  weightDisplayUnit,
  onWeightDisplayUnitChange,
  loggingGapDays,
  onLoggingGapDaysChange,
  onSuccess,
}: UserProfileFormProps) {
  const [loggingGapInput, setLoggingGapInput] = useState(String(loggingGapDays));
  const [formData, setFormData] = useState({
    height: '',
    height_unit: 'cm',
    age: '',
    biological_sex: '',
    activity_level: '',
    daily_calorie_target: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load existing profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/profile');
        const result = await response.json();
        
        if (response.ok && result.data) {
          setFormData({
            height: result.data.height?.toString() || '',
            height_unit: result.data.height_unit || 'cm',
            age: result.data.age?.toString() || '',
            biological_sex: result.data.biological_sex || '',
            activity_level: result.data.activity_level || '',
            daily_calorie_target: result.data.daily_calorie_target?.toString() || '',
            notes: result.data.notes || '',
          });
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const profileData: UserProfile = {
        height: formData.height ? parseFloat(formData.height) : undefined,
        height_unit: formData.height_unit as 'cm' | 'inches' | 'feet',
        age: formData.age ? parseInt(formData.age, 10) : undefined,
        biological_sex: formData.biological_sex ? formData.biological_sex as 'male' | 'female' : undefined,
        activity_level: formData.activity_level
          ? formData.activity_level as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
          : undefined,
        daily_calorie_target: formData.daily_calorie_target ? parseInt(formData.daily_calorie_target, 10) : undefined,
        notes: formData.notes || undefined,
      };

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save profile');
      }

      setMessage({ type: 'success', text: 'Profile saved successfully!' });

      // Call onSuccess callback if provided (e.g., to close modal)
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1000); // Small delay to show success message
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600 dark:text-gray-400">Loading profile...</div>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
      <section className="mb-6 border-b border-gray-200 pb-6 dark:border-gray-700">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">About you</h3>
        {/* Height Input */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="height" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Height (Optional)
            </label>
            <input
              type="number"
              id="height"
              name="height"
              value={formData.height}
              onChange={handleChange}
              step="0.01"
              min="0.01"
              placeholder="0.00"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="height_unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Unit
            </label>
            <select
              id="height_unit"
              name="height_unit"
              value={formData.height_unit}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="cm">cm</option>
              <option value="inches">inches</option>
              <option value="feet">feet</option>
            </select>
          </div>
        </div>

        {/* Age Input */}
        <div>
          <label htmlFor="age" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Age (Optional)
          </label>
          <input
            type="number"
            id="age"
            name="age"
            value={formData.age}
            onChange={handleChange}
            min="0"
            max="150"
            placeholder="e.g., 30"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Add any additional notes..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>

      </section>

      <section className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Calorie estimate</h3>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          These optional inputs estimate maintenance calories; the result is always an estimate.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="biological_sex" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Biological sex coefficient (optional)
            </label>
            <select
              id="biological_sex"
              name="biological_sex"
              value={formData.biological_sex}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Not set</option>
              <option value="male">Male formula (+5)</option>
              <option value="female">Female formula (-161)</option>
            </select>
          </div>

          <div>
            <label htmlFor="activity_level" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Activity multiplier (optional)
            </label>
            <select
              id="activity_level"
              name="activity_level"
              value={formData.activity_level}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Not set</option>
              <option value="sedentary">Sedentary · 1.2</option>
              <option value="light">Light · 1.375</option>
              <option value="moderate">Moderate · 1.55</option>
              <option value="active">Active · 1.725</option>
              <option value="very_active">Very active · 1.9</option>
            </select>
          </div>

          <div>
            <label htmlFor="daily_calorie_target" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Daily calorie target (optional, kcal)
            </label>
            <input
              type="number"
              id="daily_calorie_target"
              name="daily_calorie_target"
              value={formData.daily_calorie_target}
              onChange={handleChange}
              min="1"
              max="10000"
              step="1"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Chart date range</h3>
        <ChartRangeControl
          id="chart-range"
          label="Show measurements from"
          value={chartRangeYears}
          onChange={onChartRangeChange}
        />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Applies to all charts and saves immediately.
        </p>
      </section>

      <section className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Display preferences</h3>
        <label htmlFor="weight-display-unit" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Weight on the summary card
        </label>
        <select
          id="weight-display-unit"
          value={weightDisplayUnit}
          onChange={(event) => onWeightDisplayUnitChange(event.target.value as 'kg' | 'lbs')}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="kg">Kilograms (kg)</option>
          <option value="lbs">Pounds (lbs)</option>
        </select>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Weight measurements are stored in kilograms. This display preference saves immediately.
        </p>
        <label htmlFor="logging-gap-days" className="mb-2 mt-5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Minimum logging break (days)
        </label>
        <input
          id="logging-gap-days"
          type="number"
          min={1}
          max={365}
          step={1}
          value={loggingGapInput}
          onChange={(event) => {
            setLoggingGapInput(event.target.value);
            const days = Number(event.target.value);
            if (Number.isInteger(days) && days >= 1 && days <= 365) onLoggingGapDaysChange(days);
          }}
          onBlur={() => setLoggingGapInput(String(loggingGapDays))}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Weight and stress insight · {loggingGapDays} consecutive unlogged days · saved on this browser.
        </p>
      </section>

      <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Personal details and calorie-estimate settings are saved together.
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isSubmitting ? 'Saving...' : 'Save Settings'}
        </button>
        {message && (
          <div className={`mt-4 rounded-lg p-4 ${message.type === 'success'
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
            {message.text}
          </div>
        )}
      </div>
      </form>
    </div>
  );
}
