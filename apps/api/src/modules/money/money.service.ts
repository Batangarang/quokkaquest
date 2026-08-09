import { ACHIEVEMENT_RATING_PERCENT, type AchievementRating } from '@quokkaquest/shared';

/**
 * Phase 1 money calc: base value scaled by the 1-5 achievement rating, with a
 * late-completion deduction applied on top if relevant.
 *
 * Age multiplier is deliberately NOT applied here yet — see architecture-decision.md
 * §7 (age multipliers are a Phase 3 item). Values are handled as integer pence
 * throughout to avoid floating-point rounding drift.
 */
export function calculateEarnedValue(params: {
  baseValuePence: number;
  rating: AchievementRating;
  isLate: boolean;
  lateDeductionPercent: number; // 0-100
}): number {
  const { baseValuePence, rating, isLate, lateDeductionPercent } = params;

  const ratingPercent = ACHIEVEMENT_RATING_PERCENT[rating];
  let value = Math.round((baseValuePence * ratingPercent) / 100);

  if (isLate && lateDeductionPercent > 0) {
    const deduction = Math.round((value * lateDeductionPercent) / 100);
    value -= deduction;
  }

  return Math.max(0, value);
}
