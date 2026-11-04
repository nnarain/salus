export const CHART_RANGE_PRESETS = [
  { value: 0.5, label: 'Last 6 months' },
  { value: 1, label: 'Last year' },
  { value: 2, label: 'Last 2 years' },
  { value: 3, label: 'Last 3 years' },
  { value: 5, label: 'Last 5 years' },
] as const;

export function getChartRangeStart(rangeYears: number, today = new Date()): Date {
  const start = new Date(today);
  const day = start.getDate();
  start.setDate(1);
  start.setMonth(start.getMonth() - Math.round(rangeYears * 12));
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  start.setDate(Math.min(day, lastDay));
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getChartRangeLabel(rangeYears: number | 'all'): string {
  if (rangeYears === 'all') return 'All available data';
  if (Number.isInteger(rangeYears)) return rangeYears === 1 ? 'Last year' : `Last ${rangeYears} years`;
  const months = Math.round(rangeYears * 12);
  return `Last ${months} ${months === 1 ? 'month' : 'months'}`;
}

export function isValidChartRange(value: number): boolean {
  return Number.isFinite(value) && value >= 1 / 12 && value <= 100
    && Math.abs(value * 12 - Math.round(value * 12)) < 1e-8;
}