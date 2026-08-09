import { describe, expect, it } from 'vitest';
import { calculateEarnedValue } from './money.service';

describe('calculateEarnedValue', () => {
  it('applies the achievement rating percentage to the base value', () => {
    const value = calculateEarnedValue({
      baseValuePence: 100,
      rating: 3, // 60% per the placeholder scale in packages/shared/src/types.ts
      isLate: false,
      lateDeductionPercent: 0,
    });
    expect(value).toBe(60);
  });

  it('awards full base value at rating 5', () => {
    const value = calculateEarnedValue({
      baseValuePence: 200,
      rating: 5,
      isLate: false,
      lateDeductionPercent: 0,
    });
    expect(value).toBe(200);
  });

  it('applies a late deduction on top of the rating percentage', () => {
    const value = calculateEarnedValue({
      baseValuePence: 100,
      rating: 5, // 100% -> 100p
      isLate: true,
      lateDeductionPercent: 25, // 25% off 100p -> 75p
    });
    expect(value).toBe(75);
  });

  it('never returns a negative value even with a large deduction', () => {
    const value = calculateEarnedValue({
      baseValuePence: 10,
      rating: 1, // 20% -> 2p
      isLate: true,
      lateDeductionPercent: 100,
    });
    expect(value).toBe(0);
  });
});
