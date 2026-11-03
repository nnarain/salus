"use client";

import { useState } from 'react';
import type { NutritionEntry } from '@/lib/types';

interface NutritionFormProps {
  onSuccess?: () => void;
}

export default function NutritionForm({ onSuccess }: NutritionFormProps = {}) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    calories_kcal: '',
    protein_grams: '',
    water_liters: '',
    estimated: false,
    partial: false,
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const nutritionData: NutritionEntry = {
        date: formData.date,
        calories_kcal: formData.calories_kcal === '' ? null : Number(formData.calories_kcal),
        protein_grams: formData.protein_grams === '' ? null : Number(formData.protein_grams),
        water_ml: formData.water_liters === '' ? null : Math.round(Number(formData.water_liters) * 1000),
        estimated: formData.estimated,
        partial: formData.partial,
        notes: formData.notes || undefined,
      };

      const response = await fetch('/api/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nutritionData),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save nutrition data');
      }

      setMessage({ type: 'success', text: 'Nutrition entry saved successfully!' });
      setFormData((previous) => ({
        ...previous, calories_kcal: '', protein_grams: '', water_liters: '', estimated: false, partial: false, notes: '',
      }));
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

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="nutrition-date" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Date
        </label>
        <input
          type="date"
          id="nutrition-date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          required
          className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="calories_kcal" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Calories (kcal)
          </label>
          <input
            type="number"
            id="calories_kcal"
            name="calories_kcal"
            value={formData.calories_kcal}
            onChange={handleChange}
            min="0"
            step="1"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="protein_grams" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Protein (g)
          </label>
          <input
            type="number"
            id="protein_grams"
            name="protein_grams"
            value={formData.protein_grams}
            onChange={handleChange}
            min="0"
            step="0.1"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="water_liters" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Water (L)
          </label>
          <input
            type="number"
            id="water_liters"
            name="water_liters"
            value={formData.water_liters}
            onChange={handleChange}
            min="0"
            step="0.1"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">Water is stored in milliliters.</p>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData.estimated}
            onChange={(event) => setFormData((previous) => ({ ...previous, estimated: event.target.checked }))}
          />
          Estimated values
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData.partial}
            onChange={(event) => setFormData((previous) => ({ ...previous, partial: event.target.checked }))}
          />
          Partial day
        </label>
      </div>

      <div>
        <label htmlFor="nutrition-notes" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Notes (Optional)
        </label>
        <textarea
          id="nutrition-notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-lime-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isSubmitting ? 'Saving...' : 'Save Nutrition Entry'}
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