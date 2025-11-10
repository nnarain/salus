"use client";

import { useState } from 'react';
import type { BiometricEntry } from '@/lib/types';

interface BiometricFormProps {
  onSuccess?: () => void;
}

export default function BiometricForm({ onSuccess }: BiometricFormProps = {}) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    metric_type: 'weight',
    value: '',
    unit: 'kg',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const biometricData: BiometricEntry = {
        date: formData.date,
        metric_type: formData.metric_type,
        value: parseFloat(formData.value),
        unit: formData.unit,
        notes: formData.notes || undefined,
      };

      const response = await fetch('/api/biometrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(biometricData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save data');
      }

      setMessage({ type: 'success', text: 'Biometric data saved successfully!' });
      
      // Reset form (keep date and metric_type)
      setFormData({
        ...formData,
        value: '',
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      // Auto-update unit when metric type changes
      if (name === 'metric_type') {
        if (value === 'weight') {
          return { ...prev, [name]: value, unit: 'kg' };
        } else if (value === 'body_fat_percentage') {
          return { ...prev, [name]: value, unit: '%' };
        } else if (value === 'waistline') {
          return { ...prev, [name]: value, unit: 'cm' };
        }
      }
      return {
        ...prev,
        [name]: value,
      };
    });
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

        {/* Metric Type */}
        <div>
          <label htmlFor="metric_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Metric Type
          </label>
          <select
            id="metric_type"
            name="metric_type"
            value={formData.metric_type}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="weight">Weight</option>
            <option value="waistline">Waistline</option>
            <option value="body_fat_percentage">Body Fat Percentage</option>
          </select>
        </div>

        {/* Value and Unit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="value" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Value
            </label>
            <input
              type="number"
              id="value"
              name="value"
              value={formData.value}
              onChange={handleChange}
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Unit
            </label>
            <select
              id="unit"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              {formData.metric_type === 'weight' ? (
                <>
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </>
              ) : formData.metric_type === 'body_fat_percentage' ? (
                <option value="%">%</option>
              ) : (
                <>
                  <option value="cm">cm</option>
                  <option value="inches">inches</option>
                </>
              )}
            </select>
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
          {isSubmitting ? 'Saving...' : 'Save Biometric Data'}
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
