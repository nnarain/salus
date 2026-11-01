interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  description?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  onInfoClick?: () => void;
  borderColor?: string;
  descriptionColor?: string;
}

export default function StatCard({
  title,
  value,
  unit,
  description,
  icon,
  loading = false,
  onInfoClick,
  borderColor = 'border-blue-200 dark:border-blue-700',
  descriptionColor = 'text-xs text-gray-500 dark:text-gray-400 mt-1',
}: StatCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-2 ${borderColor} hover:shadow-xl transition-all`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {title}
            </p>
            {onInfoClick && (
              <button
                onClick={onInfoClick}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                aria-label="More information"
                title="More information"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </button>
            )}
          </div>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-2"></div>
              {description && (
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {value}
                </p>
                {unit && (
                  <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
                    {unit}
                  </p>
                )}
              </div>
              {description && (
                <p className={descriptionColor}>
                  {description}
                </p>
              )}
            </>
          )}
        </div>
        {icon && (
          <div className="ml-4 flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
