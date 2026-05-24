// IV&V verification environment for `variance` (population variance).
// Independence: derived ONLY from spec.md. The SUT is imported by name; sut.ts is never read.
//
// CHARTER MR-SOUNDNESS DISCIPLINE (Phase D):
//   Every metamorphic relation here holds for a CORRECT implementation too. We do NOT
//   assert translation-invariance with shifts so large the shifted inputs lose representable
//   precision (that would reject even a correct two-pass algorithm — a false positive).
//   To catch a numerically-UNSTABLE implementation SOUNDLY we instead rely on:
//     (1) a numerically-stable TWO-PASS reference model scoreboard, and
//     (2) DIRECTED large-magnitude but EXACTLY-REPRESENTABLE integer goldens whose true
//         variance is hand-derived, so any divergence is the ALGORITHM's fault, not the
//         input's unrepresentability.
//   Translation-invariance is asserted ONLY for SMALL/representable shifts.
//
// All inputs used as MR transforms are checked to remain exactly representable
// (Number.isSafeInteger / exact) before the relation is asserted, so a correct
// implementation always passes.

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { variance } from './sut';

// ----------------------------------------------------------------------------
// Independent reference model — NUMERICALLY-STABLE TWO-PASS, straight from spec:
//   variance(xs) = (1/n) Σ (xᵢ − mean)²,  mean = (1/n) Σ xᵢ
// This computes the mean FIRST, then the mean of squared deviations — it does NOT
// form E[x²] and subtract E[x]², so it does not suffer catastrophic cancellation.
// ----------------------------------------------------------------------------
function refVariance(xs: number[]): number {
  if (xs.length === 0) throw new Error('variance of empty array is undefined');
  const n = xs.length;
  let sum = 0;
  for (const x of xs) sum += x;
  const mean = sum / n;
  let acc = 0;
  for (const x of xs) {
    const d = x - mean;
    acc += d * d;
  }
  return acc / n;
}

// Relative-or-absolute closeness. Tight enough that an order-of-magnitude precision
// failure is NOT masked, loose enough to absorb legitimate IEEE-754 rounding.
function closeEnough(a: number, b: number, relTol = 1e-9, absTol = 1e-9): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  if (diff <= absTol) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return diff <= relTol * scale;
}

// Constrained-random generator over the SPEC domain (finite, non-NaN).
// Kept to a magnitude where the values themselves are comfortably representable so
// the reference model is the sole judge of stability, never the inputs.
const finiteNum = fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 });
const nonEmptyArr = fc.array(finiteNum, { minLength: 1, maxLength: 50 });

// ============================================================================
// SELF-TEST OF THE BENCH: prove the reference model + tolerances PASS a correct
// stable implementation. If these fail, the bench is unsound (false-positive risk).
// ============================================================================
describe('bench self-test — a correct stable two-pass passes every check', () => {
  test('reference model matches all spec worked examples', () => {
    expect(closeEnough(refVariance([2, 4, 4, 4, 5, 5, 7, 9]), 4)).toBe(true);
    expect(closeEnough(refVariance([1, 2, 3]), 0.6666666666666666)).toBe(true);
    expect(refVariance([5, 5, 5])).toBe(0);
    expect(refVariance([42])).toBe(0);
  });

  test('reference model passes the large-exact-integer golden (sanity for soundness)', () => {
    // [1e8, 1e8+1, 1e8+2] deviations −1,0,1 → variance exactly 2/3.
    expect(closeEnough(refVariance([100000000, 100000001, 100000002]), 2 / 3)).toBe(true);
    // and the even larger one used in the DUT golden below
    expect(closeEnough(refVariance([1000000000, 1000000001, 1000000002]), 2 / 3)).toBe(true);
  });

  test('reference model passes translation-invariance at the SMALL shifts we assert', () => {
    const xs = [1, 2, 3, 4, 5];
    for (const k of [0, 1, -1, 10, 100, 1000]) {
      expect(closeEnough(refVariance(xs), refVariance(xs.map((x) => x + k)))).toBe(true);
    }
  });
});

// ============================================================================
// Worked examples — hand-derived golden values quoted directly from spec.md.
// ============================================================================
describe('variance — worked examples (golden values from spec)', () => {
  test('[2,4,4,4,5,5,7,9] → 4', () => {
    expect(variance([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(4, 12);
  });
  test('[1,2,3] → 0.6666666666666666', () => {
    expect(variance([1, 2, 3])).toBeCloseTo(0.6666666666666666, 12);
  });
  test('[5,5,5] → 0', () => {
    expect(variance([5, 5, 5])).toBe(0);
  });
  test('[42] → 0', () => {
    expect(variance([42])).toBe(0);
  });
});

// ============================================================================
// Empty array → throw (spec: variance of no data is undefined).
// ============================================================================
describe('variance — empty array throws', () => {
  test('throws on []', () => {
    expect(() => variance([])).toThrow();
  });
});

// ============================================================================
// Scoreboard — DUT vs stable two-pass reference, over constrained-random inputs.
// The inputs are representable; the only way to diverge is an unstable algorithm.
// ============================================================================
describe('variance — scoreboard vs stable two-pass reference model', () => {
  test('matches reference model over constrained-random inputs', () => {
    fc.assert(
      fc.property(nonEmptyArr, (xs) => {
        const dut = variance(xs);
        const ref = refVariance(xs);
        // relative tolerance so legitimately large variances are judged by ratio
        expect(closeEnough(dut, ref, 1e-9, 1e-9)).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });
});

// ============================================================================
// THE HEADLINE DETECTOR — DIRECTED, large-magnitude, EXACTLY-REPRESENTABLE goldens.
//
//   Inputs are exact integers below 2^53, so they (and their pairwise differences)
//   are represented with ZERO error. The TRUE variance is hand-derived below.
//   A correct stable two-pass returns it. A naive E[x²]−E[x]² blows up because x²
//   reaches ~1e16/1e18, beyond 2^53 ≈ 9.007e15, destroying low-order bits.
//   Because the inputs are exact, ANY divergence is the algorithm's fault — SOUND.
// ============================================================================
describe('variance — directed large-exact-integer goldens (sound instability detector)', () => {
  // variance([1e8, 1e8+1, 1e8+2]): deviations −1,0,1 → squares 1,0,1 → (1+0+1)/3 = 2/3.
  test('[1e8, 1e8+1, 1e8+2] → 2/3 exactly', () => {
    const xs = [100000000, 100000001, 100000002];
    // confirm inputs are exact integers (soundness precondition)
    expect(xs.every((x) => Number.isSafeInteger(x))).toBe(true);
    expect(variance(xs)).toBeCloseTo(2 / 3, 6);
  });

  // variance([1e9, 1e9+1, 1e9+2]): same deviations → 2/3. Here x² ≈ 1e18, far past 2^53.
  test('[1e9, 1e9+1, 1e9+2] → 2/3 exactly', () => {
    const xs = [1000000000, 1000000001, 1000000002];
    expect(xs.every((x) => Number.isSafeInteger(x))).toBe(true);
    expect(variance(xs)).toBeCloseTo(2 / 3, 6);
  });

  // Wider, still-exact spread: [1e9, 1e9+10, 1e9+20] mean=1e9+10, dev −10,0,10 →
  // squares 100,0,100 → variance 200/3 ≈ 66.6667.
  test('[1e9, 1e9+10, 1e9+20] → 200/3', () => {
    const xs = [1000000000, 1000000010, 1000000020];
    expect(xs.every((x) => Number.isSafeInteger(x))).toBe(true);
    expect(variance(xs)).toBeCloseTo(200 / 3, 4);
  });

  // Even larger base, small exact spread: [2^40, 2^40+1, 2^40+2] → 2/3.
  // 2^40 = 1099511627776, +1/+2 still exact; x² ≈ 1.2e24, catastrophic for naive.
  test('[2^40, 2^40+1, 2^40+2] → 2/3', () => {
    const b = 2 ** 40;
    const xs = [b, b + 1, b + 2];
    expect(xs.every((x) => Number.isSafeInteger(x))).toBe(true);
    expect(variance(xs)).toBeCloseTo(2 / 3, 6);
  });

  // Scoreboard the same family against the stable reference (defense in depth).
  test('large-exact families match the stable reference model', () => {
    const families = [
      [100000000, 100000001, 100000002],
      [1000000000, 1000000001, 1000000002],
      [1000000000, 1000000010, 1000000020],
      [2 ** 40, 2 ** 40 + 1, 2 ** 40 + 2]
    ];
    for (const xs of families) {
      expect(closeEnough(variance(xs), refVariance(xs), 1e-9, 1e-9)).toBe(true);
    }
  });
});

// ============================================================================
// Invariant: non-negativity (spec).
// ============================================================================
describe('variance — invariant: non-negativity', () => {
  test('variance(xs) >= 0 and finite', () => {
    fc.assert(
      fc.property(nonEmptyArr, (xs) => {
        const v = variance(xs);
        expect(Number.isFinite(v)).toBe(true);
        // a tiny negative epsilon from float cancellation is tolerable; real negativity is not
        expect(v).toBeGreaterThanOrEqual(-1e-9);
      }),
      { numRuns: 2000 }
    );
  });
});

// ============================================================================
// Invariant: zero spread (spec) — constant array → 0.
// ============================================================================
describe('variance — invariant: zero spread', () => {
  // SOUNDNESS NOTE: we use a tiny absolute tolerance, NOT strict toBe(0).
  // A subnormal `val` (e.g. ~3e-155) can make a CORRECT implementation emit a
  // ±denormal (e.g. -5e-324) from val*val underflow / acc/n rounding. Demanding
  // exact 0 would reject a correct algorithm (a false positive), so we tolerate
  // sub-ulp noise while still catching any genuine non-zero spread.
  test('constant array → 0 (within denormal noise)', () => {
    fc.assert(
      fc.property(finiteNum, fc.integer({ min: 1, max: 50 }), (val, len) => {
        const xs = new Array(len).fill(val);
        const v = variance(xs);
        // exact zero OR sub-ulp noise relative to val² (the natural scale of squared deviations)
        const scale = Math.max(1, val * val);
        expect(Math.abs(v)).toBeLessThanOrEqual(1e-9 * scale + Number.MIN_VALUE * 4);
      }),
      { numRuns: 1000 }
    );
  });

  test('integer constant arrays → exactly 0', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: 1, max: 50 }), (val, len) => {
        expect(variance(new Array(len).fill(val))).toBe(0);
      }),
      { numRuns: 500 }
    );
  });
});

// ============================================================================
// Invariant: permutation invariance (oracle-free; order must not matter).
// ============================================================================
describe('variance — invariant: permutation invariance', () => {
  test('shuffling does not change variance', () => {
    fc.assert(
      fc.property(nonEmptyArr, (xs) => {
        const shuffled = [...xs].reverse();
        expect(closeEnough(variance(xs), variance(shuffled), 1e-9, 1e-9)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });
});

// ============================================================================
// Invariant: scale relation (spec) — variance(c·xs) === c² · variance(xs).
// Bounded c and inputs so both sides stay representable (SOUND).
// ============================================================================
describe('variance — invariant: scale relation', () => {
  test('variance(c·xs) === c² · variance(xs)', () => {
    fc.assert(
      fc.property(nonEmptyArr, fc.double({ noNaN: true, noDefaultInfinity: true, min: -1000, max: 1000 }), (xs, c) => {
        const scaled = xs.map((x) => c * x);
        const lhs = variance(scaled);
        const rhs = c * c * variance(xs);
        // relative tolerance — c² can be large, so judge by ratio
        expect(closeEnough(lhs, rhs, 1e-6, 1e-6)).toBe(true);
      }),
      { numRuns: 1500 }
    );
  });
});

// ============================================================================
// Invariant: translation invariance — SOUND VERSION.
//
//   Asserted ONLY for shifts where xs+k remains exactly/near-exactly representable,
//   so a CORRECT two-pass passes. We use a small integer spread and bounded integer
//   shifts that keep every element a safe integer. This is a legitimate MR (location
//   does not change spread) AND it does not punish a correct algorithm.
//
//   We deliberately DO NOT use 1e9/1e12 shifts on a tiny spread as a pass/fail MR,
//   because that crosses into the regime where representability — not the algorithm —
//   could decide the outcome. Instability at huge magnitudes is caught by the
//   exact-integer goldens above, which ARE sound.
// ============================================================================
describe('variance — invariant: translation invariance (small representable shifts)', () => {
  const smallKs = [0, 1, -1, 2, 10, -10, 100, -100, 1000, -1000];

  for (const k of smallKs) {
    test(`directed: variance([1..5]) === variance([1..5]+${k})`, () => {
      const xs = [1, 2, 3, 4, 5]; // true variance = 2
      const base = variance(xs);
      const shifted = variance(xs.map((x) => x + k));
      expect(closeEnough(base, shifted, 1e-9, 1e-9)).toBe(true);
    });
  }

  test('property: translation invariance over random xs + bounded integer k (representable)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 1, maxLength: 50 }),
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        (xs, k) => {
          const shifted = xs.map((x) => x + k);
          // soundness guard: all shifted values exact integers → correct algo must pass
          fc.pre(shifted.every((v) => Number.isSafeInteger(v)));
          expect(closeEnough(variance(xs), variance(shifted), 1e-7, 1e-7)).toBe(true);
        }
      ),
      { numRuns: 1500 }
    );
  });
});

// ============================================================================
// DIAGNOSTIC — print exact DUT vs reference numbers (non-asserting) so any
// discrepancy is concrete in the report.
// ============================================================================
describe('variance — DIAGNOSTIC actual values', () => {
  test('print large-exact-integer behaviour', () => {
    const families: number[][] = [
      [100000000, 100000001, 100000002],
      [1000000000, 1000000001, 1000000002],
      [1000000000, 1000000010, 1000000020],
      [2 ** 40, 2 ** 40 + 1, 2 ** 40 + 2]
    ];
    for (const xs of families) {
      // eslint-disable-next-line no-console
      console.log(`xs=${JSON.stringify(xs)}  DUT=${variance(xs)}  ref=${refVariance(xs)}`);
    }
    expect(true).toBe(true);
  });
});
