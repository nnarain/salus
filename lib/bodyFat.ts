import type { BiometricEntry, BodyFatEstimate, UserProfile } from '@/lib/types';

export function averageBodyFatPercentage(logged?: number, estimated?: number): number | undefined {
  const values = [logged, estimated].filter((value): value is number =>
    value !== undefined && Number.isFinite(value) && value > 0 && value < 100);
  return values.length === 0 ? undefined
    : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

export function estimateRelativeFatMass(
  waist: Pick<BiometricEntry, 'value' | 'unit'>,
  profile: UserProfile | null,
): number | undefined {
  if (!profile || !Number.isFinite(profile.age) || profile.age! < 20
    || !Number.isFinite(profile.height) || profile.height! <= 0
    || !Number.isFinite(waist.value) || waist.value <= 0) return undefined;
  if (profile.biological_sex !== 'male' && profile.biological_sex !== 'female') return undefined;

  const heightFactor = profile.height_unit
    ? { cm: 1, inches: 2.54, feet: 30.48 }[profile.height_unit]
    : undefined;
  const waistFactor = waist.unit === 'cm' ? 1 : waist.unit === 'inches' ? 2.54 : undefined;
  if (heightFactor === undefined || waistFactor === undefined) return undefined;

  const percentage = 64 - 20 * (profile.height! * heightFactor) / (waist.value * waistFactor)
    + (profile.biological_sex === 'female' ? 12 : 0);
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage >= 100) return undefined;
  const rounded = Number(percentage.toFixed(1));
  return rounded > 0 && rounded < 100 ? rounded : undefined;
}

export function getBodyFatEstimates(entries: BiometricEntry[], profile: UserProfile | null): BodyFatEstimate[] {
  const waistEntries = entries.filter((entry) => entry.metric_type === 'waistline')
    .sort((first, second) => second.date.localeCompare(first.date)
      || new Date(second.created_at ?? 0).getTime() - new Date(first.created_at ?? 0).getTime()
      || (second.id ?? '').localeCompare(first.id ?? ''));
  const seenDates = new Set<string>();
  return waistEntries.flatMap((entry) => {
    if (seenDates.has(entry.date)) return [];
    seenDates.add(entry.date);
    const percentage = estimateRelativeFatMass(entry, profile);
    return percentage === undefined ? [] : [{ date: entry.date, percentage, method: 'rfm' as const }];
  });
}