// Independent VE testbench — derived ONLY from spec.md.
// Contract: currency(value).distribute(count) splits the amount as evenly as
// possible into `count` parts; leftover minor units (pennies) stack onto the
// FIRST entries. Invariants: conservation (parts sum to original exactly),
// length === count, parts differ by at most one minor unit, sign consistency.
import { describe, test, expect } from 'vitest';
import currency from './sut';

// Use intValue (integer minor units) for all checks to stay float-safe, exactly
// as the spec says the value is stored internally.
function partsIntValues(amount: number | string, count: number): number[] {
  return currency(amount).distribute(count).map((c) => c.intValue);
}

describe('currency.distribute — documented golden example', () => {
  test('currency(1.12).distribute(5) => [0.23,0.23,0.22,0.22,0.22]', () => {
    const parts = currency(1.12).distribute(5);
    expect(parts.map((p) => p.value)).toEqual([0.23, 0.23, 0.22, 0.22, 0.22]);
    // minor units: 112 = 5*22 + 2; the two leftover pennies on the first two parts
    expect(parts.map((p) => p.intValue)).toEqual([23, 23, 22, 22, 22]);
  });
});

describe('currency.distribute — length invariant', () => {
  for (const count of [1, 2, 3, 5, 7, 10]) {
    test(`distribute(${count}) returns exactly ${count} parts`, () => {
      expect(currency(10.0).distribute(count).length).toBe(count);
    });
  }
});

describe('currency.distribute — conservation (defining property)', () => {
  // Sum of parts (in minor units) must equal the original intValue exactly.
  const amounts = [0, 0.01, 1, 1.12, 12.3, 100, 0.99, 5.05, 9.99, 1234.56];
  const counts = [1, 2, 3, 4, 5, 7, 11, 100];
  for (const amt of amounts) {
    for (const count of counts) {
      test(`sum(distribute) === intValue for amount=${amt}, count=${count}`, () => {
        const orig = currency(amt).intValue;
        const sum = partsIntValues(amt, count).reduce((a, b) => a + b, 0);
        expect(sum).toBe(orig);
      });
    }
  }
});

describe('currency.distribute — negative amounts preserve sign & conserve', () => {
  // Spec "Sign consistency": parts share the original sign (or zero); total
  // equals original in magnitude AND sign.
  const negAmounts = [-1.12, -0.01, -5.05, -100, -9.99];
  const counts = [1, 2, 3, 5, 7];
  for (const amt of negAmounts) {
    for (const count of counts) {
      test(`negative amount=${amt}, count=${count}`, () => {
        const orig = currency(amt).intValue;
        const iv = partsIntValues(amt, count);
        // conservation
        expect(iv.reduce((a, b) => a + b, 0)).toBe(orig);
        // sign consistency: every part is <= 0 (same sign as original, or zero)
        for (const part of iv) {
          expect(part).toBeLessThanOrEqual(0);
        }
      });
    }
  }
});

describe('currency.distribute — even split, at most one minor unit apart', () => {
  const amounts = [1.12, 12.34, 0.07, 100.01, 9.99, 5.0];
  const counts = [2, 3, 5, 7, 11];
  for (const amt of amounts) {
    for (const count of counts) {
      test(`max-min <= 1 minor unit for amount=${amt}, count=${count}`, () => {
        const iv = partsIntValues(amt, count);
        const max = Math.max(...iv);
        const min = Math.min(...iv);
        expect(max - min).toBeLessThanOrEqual(1);
      });
    }
  }
});

describe('currency.distribute — leftover pennies land on the FIRST entries', () => {
  // Spec: the |intValue| mod count leftover units are placed on the first parts,
  // so the leading parts are the larger-magnitude ones; the sequence of
  // magnitudes is non-increasing.
  const amounts = [1.12, 12.34, 0.07, 100.01, 7.03];
  const counts = [2, 3, 5, 7];
  for (const amt of amounts) {
    for (const count of counts) {
      test(`leading parts not smaller in magnitude for amount=${amt}, count=${count}`, () => {
        const iv = partsIntValues(amt, count).map((x) => Math.abs(x));
        for (let i = 1; i < iv.length; i++) {
          // non-increasing magnitude: earlier parts carry the leftover
          expect(iv[i - 1]!).toBeGreaterThanOrEqual(iv[i]!);
        }
      });
    }
  }
});
