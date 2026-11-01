"use client";

import { useState } from 'react';
import type { SleepEntry } from '@/lib/types';

interface SleepFormProps {
  onSuccess?: () => void;
}

export default function SleepForm({ onSuccess }: SleepFormProps = {}) {
  const [formData, setFormData] = useState({
    wake_date: new Date().toISOString().split('T')[0],
    bedtime: '23:00',
    wake_time: '07:00',
    sleep_duration_hours: '8',
    restedness: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const sleepData: SleepEntry = {
        wake_date: formData.wake_date,
        bedtime: formData.bedtime,
        wake_time: formData.wake_time,
        sleep_duration_minutes: Math.round(Number(formData.sleep_duration_hours) * 60),
        restedness: formData.restedness ? Number(formData.restedness) : undefined,
        notes: formData.notes || undefined,
      };

      const response = await fetch('/api/sleep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sleepData),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save sleep data');
      }

      setMessage({ type: 'success', text: 'Sleep entry saved successfully!' });
      setFormData((previous) => ({ ...previous, notes: '', restedness: '' }));
      if (onSuccess) setTimeout(onSuccess, 1000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="wake_date" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Wake-up date
        </label>
        <input
          type="date"
          id="wake_date"
          name="wake_date"
          value={formData.wake_date}
          onChange={handleChange}
          required
          className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Use the morning this sleep session ended.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="bedtime" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Bedtime
          </label>
          <input
            type="time"
            id="bedtime"
            name="bedtime"
            value={formData.bedtime}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="wake_time" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Wake time
          </label>
          <input
            type="time"
            id="wake_time"
            name="wake_time"
            value={formData.wake_time}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label htmlFor="sleep_duration_hours" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Total sleep (hours)
        </label>
        <input
          type="number"
          id="sleep_duration_hours"
          name="sleep_duration_hours"
          value={formData.sleep_duration_hours}
          onChange={handleChange}
          min="0.25"
          max="24"
          step="0.25"
          required
          className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label htmlFor="restedness" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          How rested do you feel? (Optional)
        </label>
        <select
          id="restedness"
          name="restedness"
          value={formData.restedness}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="">Not rated</option>
          <option value="1">1 · Not rested</option>
          <option value="2">2 · A little rested</option>
          <option value="3">3 · Okay</option>
          <option value="4">4 · Rested</option>
          <option value="5">5 · Very rested</option>
        </select>
      </div>

      <div>
        <label htmlFor="notes" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Notes (Optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          placeholder="Awakenings or anything that affected your sleep"
          className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-teal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isSubmitting ? 'Saving...' : 'Save Sleep Entry'}
      </button>

      {message && (
        <div className={`rounded-lg p-4 ${message.type === 'success'
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
          {message.text}
        </div>
      )}
    </form>
  );
}