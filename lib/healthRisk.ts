// Health risk calculation utilities

/**
 * Health anchors for body fat percentage
 * Based on general health research for metabolic health
 * These values work as general guidelines across genders
 */
export const BODY_FAT_ANCHORS = {
  ideal: 18,      // Optimal metabolic health range (athletic/fitness level)
  threshold: 32,  // Where health risk meaningfully increases (obese range)
};

/**
 * Health anchors for waist-to-height ratio
 * Based on research showing < 0.5 is healthy, > 0.6 is high risk
 */
export const WAIST_HEIGHT_ANCHORS = {
  ideal: 0.43,    // Optimal metabolic health
  threshold: 0.6, // Where health risk meaningfully increases
};

/**
 * Normalize a health metric onto a 0-1 scale using health-centered anchors
 * 
 * @param value - The measured value
 * @param ideal - The ideal/optimal value (0 on the scale)
 * @param threshold - The risk threshold value (1 on the scale)
 * @returns Normalized score where 0 = ideal/healthy, 1 = high-risk
 */
export function normalizeHealthMetric(
  value: number,
  ideal: number,
  threshold: number
): number {
  const score = (value - ideal) / (threshold - ideal);
  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate averaged health risk indicator from body fat % and waist-to-height ratio
 * 
 * @param bodyFatPercentage - Body fat percentage value (optional)
 * @param waistHeightRatio - Waist-to-height ratio value (optional)
 * @returns Averaged health risk score (0-1) or null if no metrics available
 */
export function calculateHealthRiskIndicator(
  bodyFatPercentage?: number,
  waistHeightRatio?: number
): number | null {
  const scores: number[] = [];

  if (bodyFatPercentage !== undefined && bodyFatPercentage !== null) {
    const bodyFatScore = normalizeHealthMetric(
      bodyFatPercentage,
      BODY_FAT_ANCHORS.ideal,
      BODY_FAT_ANCHORS.threshold
    );
    scores.push(bodyFatScore);
  }

  if (waistHeightRatio !== undefined && waistHeightRatio !== null) {
    const waistHeightScore = normalizeHealthMetric(
      waistHeightRatio,
      WAIST_HEIGHT_ANCHORS.ideal,
      WAIST_HEIGHT_ANCHORS.threshold
    );
    scores.push(waistHeightScore);
  }

  // Return average if we have at least one score
  if (scores.length > 0) {
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  return null;
}

/**
 * Get a human-readable risk level description
 * 
 * @param riskScore - Health risk score (0-1)
 * @returns Description of risk level
 */
export function getRiskLevelDescription(riskScore: number): string {
  if (riskScore < 0.33) {
    return 'Low Risk';
  } else if (riskScore < 0.67) {
    return 'Moderate Risk';
  } else {
    return 'High Risk';
  }
}

/**
 * Get color for risk level visualization
 * 
 * @param riskScore - Health risk score (0-1)
 * @returns Hex color code
 */
export function getRiskLevelColor(riskScore: number): string {
  if (riskScore < 0.33) {
    return '#10b981'; // green - low risk
  } else if (riskScore < 0.67) {
    return '#f59e0b'; // amber - moderate risk
  } else {
    return '#ef4444'; // red - high risk
  }
}
