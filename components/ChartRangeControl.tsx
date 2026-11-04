"use client";

import { useState } from 'react';
import { CHART_RANGE_PRESETS } from '@/lib/chartRange';

interface ChartRangeControlProps {
  id: string;
  value: number | 'all';
  onChange: (range: number | 'all') => void;
  label?: string;
}

export default function ChartRangeControl({ id, value, onChange, label = 'Date range' }: ChartRangeControlProps) {
  const [customMode, setCustomMode] = useState(false);
  const [draftMonths, setDraftMonths] = useState<string | null>(null);
  const isPreset = value === 'all' || CHART_RANGE_PRESETS.some((preset) => preset.value === value);
  const showCustom = customMode || !isPreset;
  const months = value === 'all' ? 12 : Math.round(value * 12);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <select
        id={id}
        value={showCustom ? 'custom' : value}
        onChange={(event) => {
          const selection = event.target.value;
          setCustomMode(selection === 'custom');
          setDraftMonths(null);
          if (selection === 'custom') {
            if (value === 'all') onChange(1);
          } else {
            onChange(selection === 'all' ? 'all' : Number(selection));
          }
        }}
        className="max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
        {CHART_RANGE_PRESETS.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
        <option value="all">All available data</option>
        <option value="custom">Custom...</option>
      </select>
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            id={`${id}-months`}
            type="number"
            min={1}
            max={1200}
            step={1}
            value={draftMonths ?? months}
            onChange={(event) => {
              setDraftMonths(event.target.value);
              const nextMonths = Number(event.target.value);
              if (Number.isInteger(nextMonths) && nextMonths >= 1 && nextMonths <= 1200) onChange(nextMonths / 12);
            }}
            onBlur={() => setDraftMonths(null)}
            className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <label htmlFor={`${id}-months`} className="text-sm text-gray-600 dark:text-gray-300">Months</label>
        </div>
      )}
    </div>
  );
}