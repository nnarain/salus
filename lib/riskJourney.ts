import { calculateHealthRiskIndicator, getRiskLevelDescription } from '@/lib/healthRisk';
import type { BiometricEntry, UserProfile } from '@/lib/types';

const DAY_MS = 86_400_000;
const ZONE_BOUNDS = [1, 0.67, 0.33, 0] as const;

export const RISK_MILESTONES = ZONE_BOUNDS.slice(0, -1).flatMap((upper, zone) =>
  Array.from({ length: 3 }, (_, index) =>
    Number((upper - (upper - ZONE_BOUNDS[zone + 1]) * (index + 1) / 3).toFixed(4))));

type Reading = { value: number; date: string };
type WaistReading = Reading & { centimeters: number; unit: 'cm' | 'inches' };
type Point = { date: string; score: number; waist?: WaistReading; bodyFat?: Reading };

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

function measurementTrend<T extends Reading>(readings: T[], value: (reading: T) => number) {
  const first = readings[0];
  const last = readings.at(-1);
  if (!first || !last) return null;
  const days = daysBetween(first.date, last.date);
  return days >= 3 ? { change: value(last) - value(first), days } : null;
}

export function getRiskJourney(entries: BiometricEntry[], profile: UserProfile | null, today = new Date()) {
  const todayKey = today.toISOString().slice(0, 10);
  const readings = entries
    .filter((entry) => (entry.metric_type === 'waistline' || entry.metric_type === 'body_fat_percentage')
      && Number.isFinite(entry.value) && entry.value > 0
      && /^\d{4}-\d{2}-\d{2}$/.test(entry.date.slice(0, 10))
      && entry.date.slice(0, 10) <= todayKey)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date)
      || (a.created_at ?? '').localeCompare(b.created_at ?? '')
      || (a.id ?? '').localeCompare(b.id ?? ''));

  let waist: WaistReading | undefined;
  let bodyFat: Reading | undefined;
  const snapshots = new Map<string, { waist?: WaistReading; bodyFat?: Reading }>();
  for (const entry of readings) {
    const date = entry.date.slice(0, 10);
    if (entry.metric_type === 'waistline') {
      const reading = waistReading(entry, profile);
      if (reading === undefined) continue;
      waist = reading;
    } else if (entry.value < 100) {
      bodyFat = { value: entry.value, date };
    } else {
      continue;
    }
    snapshots.set(date, { waist, bodyFat });
  }

  const currentScore = calculateHealthRiskIndicator(bodyFat?.value, waist?.value);
  if (currentScore === null) return null;

  const currentDate = [waist?.date, bodyFat?.date].filter((date): date is string => !!date).sort().at(-1)!;
  const points: Point[] = [];
  for (const [date, snapshot] of Array.from(snapshots)) {
    // Compare the same set of metrics, and don't carry an old reading indefinitely.
    if (!!snapshot.waist !== !!waist || !!snapshot.bodyFat !== !!bodyFat
      || (snapshot.waist && daysBetween(snapshot.waist.date, date) > 30)
      || (snapshot.bodyFat && daysBetween(snapshot.bodyFat.date, date) > 30)) continue;
    const score = calculateHealthRiskIndicator(snapshot.bodyFat?.value, snapshot.waist?.value);
    if (score !== null) points.push({ date, score, ...snapshot });
  }

  const recent = points.filter((point) => daysBetween(point.date, todayKey) <= 14);
  const first = recent[0];
  const last = recent.at(-1);
  const span = first && last ? daysBetween(first.date, last.date) : 0;
  const trend = first && last && last.date === currentDate && span >= 3
    && (!waist || daysBetween(waist.date, todayKey) <= 30)
    && (!bodyFat || daysBetween(bodyFat.date, todayKey) <= 30)
    ? { change: last.score - first.score, days: span, perDay: (last.score - first.score) / span }
    : null;

  const recentSnapshots = Array.from(snapshots)
    .filter(([date]) => daysBetween(date, todayKey) <= 14);
  const recentWaist = recentSnapshots.flatMap(([date, snapshot]) =>
    snapshot.waist?.date === date ? [snapshot.waist] : []);
  const recentBodyFat = recentSnapshots.flatMap(([date, snapshot]) =>
    snapshot.bodyFat?.date === date ? [snapshot.bodyFat] : []);
  const waistTrend = measurementTrend(recentWaist, (reading) => reading.centimeters);
  const bodyFatTrend = measurementTrend(recentBodyFat, (reading) => reading.value);

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
    score: currentScore, zone, currentDate, today: todayKey, waist, bodyFat, trend, waistTrend, bodyFatTrend, nextMilestone, nextZone,
    milestoneDays: estimateDays(nextMilestone),
    nextZoneDays: estimateDays(nextZone?.score ?? null, true),
    lowRiskDays: estimateDays(zone === 'Low Risk' ? null : 0.33, true),
  };
}
