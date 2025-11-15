"use client";

import { useState } from 'react';

interface CsvImportFormProps {
  onSuccess?: () => void;
}

type DataType = 'biometric' | 'activity' | 'stress';

export default function CsvImportForm({ onSuccess }: CsvImportFormProps = {}) {
  const [dataType, setDataType] = useState<DataType>('biometric');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a CSV file' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const text = await file.text();
      
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataType,
          csvData: text,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import data');
      }

      setMessage({ 
        type: 'success', 
        text: `Successfully imported ${result.imported} record(s)${result.skipped > 0 ? ` (${result.skipped} skipped due to errors)` : ''}` 
      });
      
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

      // Call onSuccess immediately to refresh data
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred during import',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getFormatExample = () => {
    switch (dataType) {
      case 'biometric':
        return `date,metric_type,value,unit,notes
2024-01-15,weight,75.5,kg,Morning weight
2024-01-15,waistline,85,cm,
2024-01-16,body_fat_percentage,18.5,%,After workout`;
      case 'activity':
        return `date,activity_name,activity_type,effort_level,duration_minutes,notes
2024-01-15,Running,cardio,7,30,Morning run
2024-01-16,Weight Training,strength,8,45,Upper body`;
      case 'stress':
        return `date,stress_level,notes
2024-01-15,3,Relaxed day
2024-01-16,7,Busy at work`;
      default:
        return '';
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Data Type Selection */}
        <div>
          <label htmlFor="dataType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Data Type
          </label>
          <select
            id="dataType"
            value={dataType}
            onChange={(e) => setDataType(e.target.value as DataType)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="biometric">Biometric Data</option>
            <option value="activity">Activity Data</option>
            <option value="stress">Stress Data</option>
          </select>
        </div>

        {/* CSV Format Information */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Expected CSV Format
          </h3>
          <pre className="text-xs bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <code>{getFormatExample()}</code>
          </pre>
          <p className="text-xs text-blue-800 dark:text-blue-300 mt-2">
            <strong>Note:</strong> The first row must contain column headers. Empty fields can be left blank but commas must be present.
          </p>
        </div>

        {/* File Upload */}
        <div>
          <label htmlFor="csv-file" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select CSV File
          </label>
          <input
            type="file"
            id="csv-file"
            accept=".csv"
            onChange={handleFileChange}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-200"
          />
          {file && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Selected: {file.name}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isUploading || !file}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Importing...' : 'Import Data'}
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

      {/* Documentation Link */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Need help with CSV format?
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          See the{' '}
          <a
            href="/docs/csv-import-format.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
          >
            CSV Import Format Documentation
          </a>
          {' '}for detailed specifications and examples.
        </p>
      </div>
    </div>
  );
}
