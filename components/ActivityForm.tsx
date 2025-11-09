"use client";

import { useState } from 'react';
import type { ActivityEntry } from '@/lib/types';

// Common activity names by type
const ACTIVITY_OPTIONS = {
  strength: [
    'Weight Training',
    'Bodyweight Exercises',
    'Resistance Training',
    'CrossFit',
    'Powerlifting',
    'Yoga',
    'Pilates',
  ],
  cardio: [
    'Running',
    'Cycling',
    'Swimming',
    'Walking',
    'Jogging',
    'Martial Arts',
    'Sports',
    'Dancing',
    'HIIT',
    'Rowing',
  ],
};

export default function ActivityForm() {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    activity_type: 'cardio' as 'strength' | 'cardio',
    activity_name: '',
    effort_level: '5',
    duration_minutes: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const activityData: ActivityEntry = {
        date: formData.date,
        activity_name: formData.activity_name,
        activity_type: formData.activity_type,
        effort_level: parseInt(formData.effort_level, 10),
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes, 10) : undefined,
        notes: formData.notes || undefined,
      };

      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activityData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save data');
      }

      setMessage({ type: 'success', text: 'Activity data saved successfully!' });
      
      // Reset form (keep date and activity_type)
      setFormData({
        ...formData,
        activity_name: '',
        effort_level: '5',
        duration_minutes: '',
        notes: '',
      });
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

  const currentActivityOptions = ACTIVITY_OPTIONS[formData.activity_type];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Add Activity
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date Input */}
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date
          </label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Activity Type */}
        <div>
          <label htmlFor="activity_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Activity Type
          </label>
          <select
            id="activity_type"
            name="activity_type"
            value={formData.activity_type}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="cardio">Cardio</option>
            <option value="strength">Strength</option>
          </select>
        </div>

        {/* Activity Name */}
        <div>
          <label htmlFor="activity_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Activity Name
          </label>
          <select
            id="activity_name"
            name="activity_name"
            value={formData.activity_name}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="">Select an activity</option>
            {currentActivityOptions.map((activity) => (
              <option key={activity} value={activity}>
                {activity}
              </option>
            ))}
            <option value="custom">Other (Custom)</option>
          </select>
        </div>

        {/* Custom Activity Name Input - shown when "Other (Custom)" is selected */}
        {formData.activity_name === 'custom' && (
          <div>
            <label htmlFor="custom_activity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Activity Name
            </label>
            <input
              type="text"
              id="custom_activity"
              name="activity_name"
              placeholder="Enter activity name"
              onChange={(e) => {
                if (e.target.value.trim()) {
                  setFormData((prev) => ({
                    ...prev,
                    activity_name: e.target.value.trim(),
                  }));
                }
              }}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
        )}

        {/* Effort Level */}
        <div>
          <label htmlFor="effort_level" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Effort Level (1-10): <span className="font-bold text-blue-500">{formData.effort_level}</span>
          </label>
          <input
            type="range"
            id="effort_level"
            name="effort_level"
            min="1"
            max="10"
            value={formData.effort_level}
            onChange={handleChange}
            required
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </div>

        {/* Duration (Optional) */}
        <div>
          <label htmlFor="duration_minutes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Duration (minutes) - Optional
          </label>
          <input
            type="number"
            id="duration_minutes"
            name="duration_minutes"
            value={formData.duration_minutes}
            onChange={handleChange}
            min="1"
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Save Activity'}
        </button>

        {/* Message Display */}
        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
            }`}
          >
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
}
