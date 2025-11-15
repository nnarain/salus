"use client";

import { useState } from 'react';

type DataType = 'biometric' | 'activity' | 'stress';

export default function CsvExportForm() {
  const [dataType, setDataType] = useState<DataType>('biometric');
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/export?dataType=${dataType}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export data');
      }

      // Get the CSV content
      const csvContent = await response.text();
      
      // Create a blob and download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataType}-data-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage({
        type: 'success',
        text: 'Data exported successfully!',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred during export',
      });
    } finally {
      setIsExporting(false);
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
      <div className="space-y-6">
        {/* Data Type Selection */}
        <div>
          <label htmlFor="exportDataType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Data Type to Export
          </label>
          <select
            id="exportDataType"
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
            CSV Export Format
          </h3>
          <pre className="text-xs bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <code>{getFormatExample()}</code>
          </pre>
          <p className="text-xs text-blue-800 dark:text-blue-300 mt-2">
            <strong>Note:</strong> The exported CSV file will use this format and can be imported back into the application.
          </p>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isExporting ? 'Exporting...' : 'Export Data'}
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
      </div>

      {/* Documentation */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          About CSV Export
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This will download all your {dataType} data in CSV format. The file can be opened in spreadsheet applications like Excel or Google Sheets, and can be re-imported using the Import Data feature.
        </p>
      </div>
    </div>
  );
}
