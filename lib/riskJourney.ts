import { calculateHealthRiskIndicator, getRiskLevelDescription, getVisceralFatScaleRatio } from '@/lib/healthRisk';
import type { BiometricEntry, UserProfile } from '@/lib/types';

const DAY_MS = 86_400_000;
const RECENT_WINDOW_DAYS = 14;
const MIN_TREND_SPAN_DAYS = 3;
const MAX_FACTOR_AGE_DAYS = 30;
const ZONE_BOUNDS = [1, 0.67, 0.33, 0] as const;

export const RISK_MILESTONES = ZONE_BOUNDS.slice(0, -1).flatMap((upper, zone) =>
  Array.from({ length: 3 }, (_, index) =>
    Number((upper - (upper - ZONE_BOUNDS[zone + 1]) * (index + 1) / 3).toFixed(4))));

type Reading = { value: number; date: string };
type WaistReading = Reading & { centimeters: number; unit: 'cm' | 'inches' };
type VisceralReading = Reading & { level: number };
type Snapshot = { date: string; score: number | null; waist?: WaistReading; bodyFat?: Reading; visceralFat?: VisceralReading };
type Point = Snapshot & { score: number };

function daysBetween(first: string, last: string): number {
  return (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / DAY_MS;
}

function waistReading(entry: BiometricEntry, profile: UserProfile | null): WaistReading | undefined {
  const height = profile?.height;
  const heightFactor = profile?.height_unit
    ? { cm: 1, inches: 2.54, feet: 30.48 }[profile.height_unit] : undefined;
  if (!height || !Number.isFinite(height) || height <= 0 || !heightFactor
    || (entry.unit !== 'cm' && entry.unit !== 'inches')) return undefined;
  const centimeters = entry.value * (entry.unit === 'cm' ? 1 : 2.54);
  return { value: centimeters / (height * heightFactor), centimeters, unit: entry.unit, date: entry.date.slice(0, 10) };
}

function readingCoverage(dates: string[], comparable = false) {
  const first = dates[0];
  const last = dates.at(-1);
  const spanDays = first && last ? daysBetween(first, last) : 0;
  const label = comparable ? 'comparable indicator dates' : 'reading dates';
  let unavailableReason: string | null = null;
  if (!first) {
    unavailableReason = `No ${label} in the past ${RECENT_WINDOW_DAYS} days. Log a current measurement, then another at least ${MIN_TREND_SPAN_DAYS} calendar days apart.`;
  } else if (spanDays < MIN_TREND_SPAN_DAYS) {
    const nextDate = new Date(`${first}T00:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + MIN_TREND_SPAN_DAYS);
    const missingDays = MIN_TREND_SPAN_DAYS - spanDays;
    unavailableReason = dates.length === 1
      ? `Only 1 of the required 2 ${label} is available in the past ${RECENT_WINDOW_DAYS} days. Log another measurement at least ${MIN_TREND_SPAN_DAYS} calendar days after the first, on or after ${nextDate.toISOString().slice(0, 10)}.`
      : `${dates.length} ${label} span ${spanDays} ${spanDays === 1 ? 'day' : 'days'}; need ${missingDays} more ${missingDays === 1 ? 'day' : 'days'} of separation, not that many extra entries. Log an updated measurement on or after ${nextDate.toISOString().slice(0, 10)}.`;
  }
  if (unavailableReason && comparable) unavailableReason += ' Compare the same available factors on both dates.';
  return { dateCount: dates.length, spanDays, unavailableReason };
}

function measurementTrend<T extends Reading>(readings: T[], value: (reading: T) => number) {
  const first = readings[0];
  const last = readings.at(-1);
  const coverage = readingCoverage(readings.map((reading) => reading.date));
  return {
    trend: first && last && !coverage.unavailableReason
      ? { change: value(last) - value(first), days: coverage.spanDays } : null,
    unavailableReason: coverage.unavailableReason,
  };
}

export function getRiskHistory(entries: BiometricEntry[], profile: UserProfile | null, today = new Date()): Snapshot[] {
  const todayKey = today.toISOString().slice(0, 10);
  const readings = entries
    .filter((entry) => (entry.metric_type === 'waistline' || entry.metric_type === 'body_fat_percentage' || entry.metric_type === 'visceral_fat_level')
      && Number.isFinite(entry.value) && (entry.metric_type === 'visceral_fat_level' ? entry.value >= 0 : entry.value > 0)
      && /^\d{4}-\d{2}-\d{2}$/.test(entry.date.slice(0, 10))
      && entry.date.slice(0, 10) <= todayKey)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date)
      || (a.created_at ?? '').localeCompare(b.created_at ?? '')
      || (a.id ?? '').localeCompare(b.id ?? ''));

  let waist: WaistReading | undefined;
  let bodyFat: Reading | undefined;
  let visceralFat: VisceralReading | undefined;
  const snapshots = new Map<string, Snapshot>();
  for (const entry of readings) {
    const date = entry.date.slice(0, 10);
    if (entry.metric_type === 'waistline') {
      const reading = waistReading(entry, profile);
      if (reading === undefined) continue;
      waist = reading;
    } else if (entry.metric_type === 'visceral_fat_level') {
      const ratio = getVisceralFatScaleRatio(entry);
      visceralFat = ratio === null ? undefined : { value: ratio, level: entry.value, date };
    } else if (entry.value < 100) {
      bodyFat = { value: entry.value, date };
    } else {
      continue;
    }
    snapshots.set(date, {
      date, waist, bodyFat, visceralFat,
      score: calculateHealthRiskIndicator(bodyFat?.value, waist?.value, visceralFat?.value),
    });
  }

  return Array.from(snapshots.values());
}

export function getRiskJourney(entries: BiometricEntry[], profile: UserProfile | null, today = new Date()) {
  const todayKey = today.toISOString().slice(0, 10);
  const snapshots = getRiskHistory(entries, profile, today);
  const current = snapshots.at(-1);
  if (!current || current.score === null) return null;
  const { waist, bodyFat, visceralFat, score: currentScore } = current;

  const currentDate = [waist?.date, bodyFat?.date, visceralFat?.date].filter((date): date is string => !!date).sort().at(-1)!;
  const points: Point[] = [];
  for (const snapshot of snapshots) {
    const { date } = snapshot;
    // Compare the same set of metrics, and don't carry an old reading indefinitely.
    if (!!snapshot.waist !== !!waist || !!snapshot.bodyFat !== !!bodyFat || !!snapshot.visceralFat !== !!visceralFat
      || (snapshot.waist && daysBetween(snapshot.waist.date, date) > MAX_FACTOR_AGE_DAYS)
      || (snapshot.bodyFat && daysBetween(snapshot.bodyFat.date, date) > MAX_FACTOR_AGE_DAYS)
      || (snapshot.visceralFat && daysBetween(snapshot.visceralFat.date, date) > MAX_FACTOR_AGE_DAYS)) continue;
    if (snapshot.score !== null) points.push({ ...snapshot, score: snapshot.score });
  }

  const recent = points.filter((point) => daysBetween(point.date, todayKey) <= RECENT_WINDOW_DAYS);
  const first = recent[0];
  const last = recent.at(-1);
  const trendCoverage = readingCoverage(recent.map((point) => point.date), true);
  const span = trendCoverage.spanDays;
  const staleFactors = [
    waist && { name: 'waist-to-height', date: waist.date },
    bodyFat && { name: 'body fat', date: bodyFat.date },
    visceralFat && { name: 'visceral fat', date: visceralFat.date },
  ].flatMap((factor) => factor && daysBetween(factor.date, todayKey) > MAX_FACTOR_AGE_DAYS
    ? [`${factor.name} (${factor.date}, ${daysBetween(factor.date, todayKey)} days old)`] : []);
  const trendUnavailableReason = staleFactors.length > 0
    ? `Refresh ${staleFactors.join(', ')}. Every contributing factor must be no more than ${MAX_FACTOR_AGE_DAYS} days old for a trend.`
    : trendCoverage.unavailableReason
      ?? (last?.date !== currentDate ? 'The latest contributing readings cannot be compared with the same factor set. Log fresh measurements for the available factors.' : null);
  const trend = first && last && !trendUnavailableReason
    ? { change: last.score - first.score, days: span, perDay: (last.score - first.score) / span }
    : null;
  const estimateUnavailableReason = trendUnavailableReason
    ?? (trend && trend.perDay >= -1e-9
      ? 'The recent indicator is stable or increasing. Date estimates require a decreasing indicator; additional entries alone do not guarantee an estimate.'
      : null);

  const recentSnapshots = snapshots.filter((snapshot) => daysBetween(snapshot.date, todayKey) <= RECENT_WINDOW_DAYS);
  const recentWaist = recentSnapshots.flatMap((snapshot) =>
    snapshot.waist?.date === snapshot.date ? [snapshot.waist] : []);
  const recentBodyFat = recentSnapshots.flatMap((snapshot) =>
    snapshot.bodyFat?.date === snapshot.date ? [snapshot.bodyFat] : []);
  const recentVisceralFat = recentSnapshots.flatMap((snapshot) =>
    snapshot.visceralFat?.date === snapshot.date ? [snapshot.visceralFat] : []);
  const waistStatus = measurementTrend(recentWaist, (reading) => reading.centimeters);
  const bodyFatStatus = measurementTrend(recentBodyFat, (reading) => reading.value);
  const visceralFatStatus = measurementTrend(recentVisceralFat, (reading) => reading.value);

  const nextMilestone = RISK_MILESTONES.find((score) => score < currentScore - 1e-9) ?? null;
  const zone = getRiskLevelDescription(currentScore);
  const nextZone = zone === 'High Risk' ? { label: 'Moderate risk', score: 0.67 }
    : zone === 'Moderate Risk' ? { label: 'Low risk', score: 0.33 } : null;
  const estimateDays = (target: number | null, crossBoundary = false): number | null => {
    if (target === null || !trend || trend.perDay >= -1e-9) return null;
    const remaining = Math.ceil((currentScore - target + (crossBoundary ? 1e-9 : 0)) / -trend.perDay)
      - daysBetween(currentDate, todayKey);
    return remaining > 0 ? remaining : null;
  };

  return {
    score: currentScore, zone, currentDate, today: todayKey, waist, bodyFat, visceralFat, trend, nextMilestone, nextZone,
    trendCoverage, trendUnavailableReason, estimateUnavailableReason,
    waistTrend: waistStatus.trend, waistTrendUnavailableReason: waistStatus.unavailableReason,
    bodyFatTrend: bodyFatStatus.trend, bodyFatTrendUnavailableReason: bodyFatStatus.unavailableReason,
    visceralFatTrend: visceralFatStatus.trend, visceralFatTrendUnavailableReason: visceralFatStatus.unavailableReason,
    milestoneDays: estimateDays(nextMilestone),
    nextZoneDays: estimateDays(nextZone?.score ?? null, true),
    lowRiskDays: estimateDays(zone === 'Low Risk' ? null : 0.33, true),
  };
}
