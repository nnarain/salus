export const ADULT_PROTEIN_RDA_GRAMS_PER_KG = 0.8;

export function estimateProteinTargetGrams(
  weightKg: number,
  gramsPerKg = ADULT_PROTEIN_RDA_GRAMS_PER_KG,
): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new RangeError('Weight must be a positive finite number of kilograms');
  }
  if (!Number.isFinite(gramsPerKg) || gramsPerKg <= 0) {
    throw new RangeError('Protein multiplier must be a positive finite number');
  }

  return Math.round(weightKg * gramsPerKg);
}