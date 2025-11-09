"use client";

import { useState } from 'react';
import type { StressEntry } from '@/lib/types';

interface StressFormProps {
  onSuccess?: () => void;
}

export default function StressForm({ onSuccess }: StressFormProps = {}) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    stress_level: '5',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const stressData: StressEntry = {
        date: formData.date,
        stress_level: parseInt(formData.stress_level, 10),
        notes: formData.notes || undefined,
      };

      const response = await fetch('/api/stress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stressData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save data');
      }

      setMessage({ type: 'success', text: 'Stress level saved successfully!' });
      
      // Reset form (keep date)
      setFormData({
        ...formData,
        stress_level: '5',
        notes: '',
      });

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Helper function to get stress level description
  const getStressLevelDescription = (level: string) => {
    const numLevel = parseInt(level, 10);
    if (numLevel <= 3) return 'Low';
    if (numLevel <= 7) return 'Moderate';
    return 'High';
  };

  return (
    <div>
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

        {/* Stress Level */}
        <div>
          <label htmlFor="stress_level" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Stress Level (1-10): <span className="font-bold text-blue-500">{formData.stress_level}</span> - {getStressLevelDescription(formData.stress_level)}
          </label>
          <input
            type="range"
            id="stress_level"
            name="stress_level"
            min="1"
            max="10"
            value={formData.stress_level}
            onChange={handleChange}
            required
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Very Low</span>
            <span>Moderate</span>
            <span>Very High</span>
          </div>
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
            placeholder="What's contributing to your stress level today?"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Save Stress Level'}
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
