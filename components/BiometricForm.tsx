"use client";

import { useEffect, useRef, useState } from 'react';
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
    scale_min: '',
    scale_max: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const latestScaleRange = useRef<{ scale_min: string; scale_max: string } | null>(null);
  const scaleRangeEdited = useRef(false);

  useEffect(() => {
    let active = true;

    const loadScaleRange = async () => {
      try {
        const response = await fetch('/api/biometrics?latestScaleRange=true');
        if (!response.ok) return;
        const result = await response.json();
        const entry: BiometricEntry | undefined = result.data?.[0];
        if (!active || latestScaleRange.current || !entry ||
            !Number.isFinite(entry.scale_min) || !Number.isFinite(entry.scale_max)) return;

        const range = { scale_min: String(entry.scale_min), scale_max: String(entry.scale_max) };
        latestScaleRange.current = range;
        if (!scaleRangeEdited.current) {
          setFormData((prev) => prev.metric_type === 'visceral_fat_level'
            ? { ...prev, ...range }
            : prev);
        }
      } catch (error) {
        if (active) console.error('Failed to load previous visceral fat range:', error);
      }
    };

    void loadScaleRange();
    return () => { active = false; };
  }, []);

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
        scale_min: formData.metric_type === 'visceral_fat_level' && formData.scale_min !== ''
          ? parseFloat(formData.scale_min)
          : undefined,
        scale_max: formData.metric_type === 'visceral_fat_level' && formData.scale_max !== ''
          ? parseFloat(formData.scale_max)
          : undefined,
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

      if (formData.metric_type === 'visceral_fat_level' && formData.scale_min !== '' && formData.scale_max !== '') {
        latestScaleRange.current = { scale_min: formData.scale_min, scale_max: formData.scale_max };
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
    if (name === 'scale_min' || name === 'scale_max') scaleRangeEdited.current = true;
    if (name === 'metric_type') scaleRangeEdited.current = false;
    const range = latestScaleRange.current;
    setFormData((prev) => {
      // Auto-update unit when metric type changes
      if (name === 'metric_type') {
        if (value === 'weight' || value === 'muscle_mass') {
          return { ...prev, [name]: value, unit: 'kg', scale_min: '', scale_max: '' };
        } else if (value === 'body_fat_percentage') {
          return { ...prev, [name]: value, unit: '%', scale_min: '', scale_max: '' };
        } else if (value === 'waistline') {
          return { ...prev, [name]: value, unit: 'cm', scale_min: '', scale_max: '' };
        } else if (value === 'visceral_fat_level') {
          return { ...prev, [name]: value, unit: 'level', scale_min: range?.scale_min ?? '', scale_max: range?.scale_max ?? '' };
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
            <option value="visceral_fat_level">Visceral Fat Level</option>
            <option value="muscle_mass">Muscle Mass</option>
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
              min={formData.metric_type === 'visceral_fat_level' ? formData.scale_min || '0' : '0.01'}
              max={formData.metric_type === 'visceral_fat_level' ? formData.scale_max || undefined : undefined}
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
              ) : formData.metric_type === 'muscle_mass' ? (
                <option value="kg">kg</option>
              ) : formData.metric_type === 'body_fat_percentage' ? (
                <option value="%">%</option>
              ) : formData.metric_type === 'visceral_fat_level' ? (
                <option value="level">level</option>
              ) : (
                <>
                  <option value="cm">cm</option>
                  <option value="inches">inches</option>
                </>
              )}
            </select>
          </div>
        </div>

        {formData.metric_type === 'visceral_fat_level' && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Scale range (Optional)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="scale_min" className="mb-2 block text-xs text-gray-600 dark:text-gray-400">
                  Minimum level
                </label>
                <input
                  type="number"
                  id="scale_min"
                  name="scale_min"
                  value={formData.scale_min}
                  onChange={handleChange}
                  step="0.01"
                  placeholder="e.g. 0"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="scale_max" className="mb-2 block text-xs text-gray-600 dark:text-gray-400">
                  Maximum level
                </label>
                <input
                  type="number"
                  id="scale_max"
                  name="scale_max"
                  value={formData.scale_max}
                  onChange={handleChange}
                  step="0.01"
                  placeholder="e.g. 15"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Store the device&apos;s range with the reading so future comparisons can account for scale differences.
            </p>
          </div>
        )}

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
