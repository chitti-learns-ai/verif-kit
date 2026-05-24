// IV&V verification environment for `dedupe` — case 06.
// Independence: this file imports the SUT BY NAME only. The implementation
// (./sut) and the oracle directory are NEVER read. Everything below is derived
// from spec.md alone.
import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { dedupe } from './sut';

// ---------------------------------------------------------------------------
// Reference model (golden) — written independently from the spec.
// SameValueZero semantics: NaN equals NaN; -0 and +0 are the same.
// JS `Set` and `Map` key equality IS SameValueZero, so it is the natural,
// spec-faithful primitive here.
// ---------------------------------------------------------------------------
function refDedupe(arr: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

// SameValueZero comparator used by checks that must not rely on the SUT's own
// notion of equality.
function sameValueZero(a: number, b: number): boolean {
  if (a === b) return true; // handles -0 === +0 (true) and all normal equals
  return Number.isNaN(a) && Number.isNaN(b); // NaN equals NaN
}

// Deep-equal that respects SameValueZero (vitest's toEqual treats NaN as equal
// and 0/-0 as equal too, but we make our own to be explicit where needed).
function svzArrayEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!sameValueZero(a[i], b[i])) return false;
  }
  return true;
}

// Monitor: extract the SameValueZero "key set" of an array as a Set.
function svzSet(arr: number[]): Set<number> {
  return new Set(arr); // Set keys use SameValueZero
}

function svzSetEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// Is `sub` a subsequence of `full` under SameValueZero? Greedy left-to-right.
function isSubsequence(sub: number[], full: number[]): boolean {
  let i = 0;
  for (const x of full) {
    if (i < sub.length && sameValueZero(sub[i], x)) i++;
  }
  return i === sub.length;
}

// ---------------------------------------------------------------------------
// Functional coverage model.
// ---------------------------------------------------------------------------
class CoverageModel {
  private bins = new Map<string, number>();
  constructor(private readonly required: string[]) {
    for (const b of required) this.bins.set(b, 0);
  }
  cover(bin: string) {
    this.bins.set(bin, (this.bins.get(bin) ?? 0) + 1);
  }
  unhit(): string[] {
    return this.required.filter((b) => (this.bins.get(b) ?? 0) === 0);
  }
  report(): string {
    return [...this.bins.entries()].map(([k, v]) => `${k}=${v}`).join(', ');
  }
}

const COVER_POINTS = [
  'n=0',
  'n=1',
  'all-distinct',
  'all-duplicate',
  'interleaved-dups',
  'has-pos-zero',
  'has-neg-zero',
  'mixed-zero',
  'single-NaN',
  'multi-NaN',
  'NaN-interleaved',
  'has-Infinity',
  'has-neg-Infinity',
  'large(>=50)',
  'already-deduped'
];
const cov = new CoverageModel(COVER_POINTS);

function classify(arr: number[]) {
  if (arr.length === 0) cov.cover('n=0');
  if (arr.length === 1) cov.cover('n=1');
  if (arr.length >= 50) cov.cover('large(>=50)');

  const set = svzSet(arr);
  if (set.size === arr.length && arr.length > 1) cov.cover('all-distinct');
  if (set.size === 1 && arr.length > 1) cov.cover('all-duplicate');
  if (set.size > 1 && set.size < arr.length) cov.cover('interleaved-dups');

  const hasPosZero = arr.some((x) => Object.is(x, 0));
  const hasNegZero = arr.some((x) => Object.is(x, -0));
  if (hasPosZero) cov.cover('has-pos-zero');
  if (hasNegZero) cov.cover('has-neg-zero');
  if (hasPosZero && hasNegZero) cov.cover('mixed-zero');

  const nanCount = arr.filter((x) => Number.isNaN(x)).length;
  if (nanCount === 1) cov.cover('single-NaN');
  if (nanCount >= 2) cov.cover('multi-NaN');
  if (nanCount >= 1 && arr.some((x) => !Number.isNaN(x))) cov.cover('NaN-interleaved');

  if (arr.some((x) => x === Infinity)) cov.cover('has-Infinity');
  if (arr.some((x) => x === -Infinity)) cov.cover('has-neg-Infinity');

  // already-deduped: input equals its own dedup
  if (svzArrayEqual(arr, refDedupe(arr))) cov.cover('already-deduped');
}

// ---------------------------------------------------------------------------
// Scoreboard: judge DUT vs reference model on every transaction.
// ---------------------------------------------------------------------------
function scoreboard(arr: number[]) {
  // Snapshot a defensive copy for the no-mutation check (Object.is-faithful).
  const before = arr.slice();

  const dut = dedupe(arr);
  const model = refDedupe(before.slice());

  classify(before);

  // 1) DUT matches independent model element-for-element (SameValueZero).
  expect(svzArrayEqual(dut, model)).toBe(true);

  // 2) No mutation of the input (length, order, AND -0/NaN identity).
  expect(arr.length).toBe(before.length);
  for (let i = 0; i < before.length; i++) {
    // Object.is distinguishes -0 from +0 and treats NaN===NaN — strictest check.
    expect(Object.is(arr[i], before[i])).toBe(true);
  }

  // 3) Returns a NEW array (not the same reference) when input is non-empty.
  // (Spec: "Return a new array". For [] some impls may return the same []; we
  // check identity only when there is observable content to protect.)
  if (before.length > 0) {
    expect(dut).not.toBe(arr);
  }

  // 4) Membership preserved under SameValueZero.
  expect(svzSetEqual(svzSet(dut), svzSet(before))).toBe(true);

  // 5) Output has no duplicates under SameValueZero.
  expect(svzSet(dut).size).toBe(dut.length);

  // 6) Subsequence of the input.
  expect(isSubsequence(dut, before)).toBe(true);

  // 7) First-occurrence order: position of each output value equals the index
  //    of its first occurrence in the input, and those indices are strictly
  //    increasing.
  const firstIdx: number[] = dut.map((v) =>
    before.findIndex((x) => sameValueZero(x, v))
  );
  for (let i = 1; i < firstIdx.length; i++) {
    expect(firstIdx[i]).toBeGreaterThan(firstIdx[i - 1]);
  }

  return dut;
}

// Arbitrary that mixes ordinary numbers with the spec's special values so the
// SameValueZero corners are exercised by constrained-random stimulus.
const specialValues = [0, -0, NaN, Infinity, -Infinity, 1, -1, 2, 5, 42];
const valueArb = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: -5, max: 5 }) }, // forces collisions
  { weight: 2, arbitrary: fc.constantFrom(...specialValues) },
  { weight: 1, arbitrary: fc.double({ noDefaultInfinity: false, noNaN: false }) }
);
const arrayArb = fc.array(valueArb, { maxLength: 60 });

// ---------------------------------------------------------------------------
// Directed worked examples (Phase C — directed corners).
// ---------------------------------------------------------------------------
describe('dedupe — directed worked examples (spec)', () => {
  test('[1,2,2,3,1] -> [1,2,3]', () => {
    expect(dedupe([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
  });
  test('[] -> []', () => {
    expect(dedupe([])).toEqual([]);
  });
  test('[5,5,5] -> [5]', () => {
    expect(dedupe([5, 5, 5])).toEqual([5]);
  });
  test('[3,1,2] -> [3,1,2] (no reordering)', () => {
    expect(dedupe([3, 1, 2])).toEqual([3, 1, 2]);
  });
  test('[0,-0] -> single zero value (SameValueZero)', () => {
    const out = dedupe([0, -0]);
    expect(out.length).toBe(1);
    expect(out[0] === 0).toBe(true); // -0 === 0 is true
  });
  test('[-0,0] -> single zero, first occurrence is -0', () => {
    const out = dedupe([-0, 0]);
    expect(out.length).toBe(1);
    // first occurrence preserved: the kept value should be -0
    expect(Object.is(out[0], -0)).toBe(true);
  });
  test('[NaN,NaN] -> [NaN] (SameValueZero)', () => {
    const out = dedupe([NaN, NaN]);
    expect(out.length).toBe(1);
    expect(Number.isNaN(out[0])).toBe(true);
  });
  test('NaN interleaved: [NaN,1,NaN,2,1] -> [NaN,1,2]', () => {
    const out = dedupe([NaN, 1, NaN, 2, 1]);
    expect(out.length).toBe(3);
    expect(Number.isNaN(out[0])).toBe(true);
    expect(out[1]).toBe(1);
    expect(out[2]).toBe(2);
  });
  test('Infinity values dedup', () => {
    expect(dedupe([Infinity, Infinity, -Infinity, Infinity])).toEqual([
      Infinity,
      -Infinity
    ]);
  });
  test('single element', () => {
    expect(dedupe([7])).toEqual([7]);
  });
});

// ---------------------------------------------------------------------------
// Scoreboard over constrained-random arrays (Phase C — random stimulus).
// ---------------------------------------------------------------------------
describe('dedupe — scoreboard vs independent reference model', () => {
  test('DUT equals model + all invariants on random arrays', () => {
    fc.assert(
      fc.property(arrayArb, (arr) => {
        scoreboard(arr);
      }),
      { numRuns: 2000 }
    );
  });
});

// ---------------------------------------------------------------------------
// Metamorphic relations (Phase D — oracle-free checks).
// ---------------------------------------------------------------------------
describe('dedupe — metamorphic relations', () => {
  test('idempotence: dedupe(dedupe(x)) deep-equals dedupe(x)', () => {
    fc.assert(
      fc.property(arrayArb, (arr) => {
        const once = dedupe(arr.slice());
        const twice = dedupe(once.slice());
        expect(svzArrayEqual(twice, once)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  test('appending duplicates of existing values does not change the result', () => {
    fc.assert(
      fc.property(arrayArb, fc.array(fc.nat({ max: 10 }), { maxLength: 10 }), (arr, picks) => {
        if (arr.length === 0) return;
        const base = dedupe(arr.slice());
        // append values already present (picked from base)
        const extra = picks.map((p) => base[p % base.length]);
        const augmented = arr.concat(extra);
        expect(svzArrayEqual(dedupe(augmented), base)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  test('dedup of an already-deduped array is the identity', () => {
    fc.assert(
      fc.property(arrayArb, (arr) => {
        const once = dedupe(arr.slice());
        expect(svzArrayEqual(dedupe(once.slice()), once)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  test('prefix relation: dedupe of a prefix is a subsequence-prefix-consistent with full', () => {
    // The first occurrence order means: relative order of distinct values in
    // dedupe(arr) equals their relative first-appearance order. Removing the
    // tail can only drop trailing distinct values, never reorder kept ones.
    fc.assert(
      fc.property(arrayArb, fc.nat(), (arr, kRaw) => {
        if (arr.length === 0) return;
        const k = kRaw % (arr.length + 1);
        const prefix = arr.slice(0, k);
        const dPrefix = dedupe(prefix.slice());
        const dFull = dedupe(arr.slice());
        // dPrefix must be a prefix-order-consistent subsequence of dFull
        // (every value in dPrefix appears in dFull in the same relative order).
        let j = 0;
        for (const v of dFull) {
          if (j < dPrefix.length && sameValueZero(dPrefix[j], v)) j++;
        }
        expect(j).toBe(dPrefix.length);
      }),
      { numRuns: 1000 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property assertions for each named invariant (Phase B/C).
// ---------------------------------------------------------------------------
describe('dedupe — invariant properties', () => {
  test('INV no-mutation (strict Object.is, incl -0/NaN identity)', () => {
    fc.assert(
      fc.property(arrayArb, (arr) => {
        const snapshot = arr.slice();
        dedupe(arr);
        expect(arr.length).toBe(snapshot.length);
        for (let i = 0; i < snapshot.length; i++) {
          expect(Object.is(arr[i], snapshot[i])).toBe(true);
        }
      }),
      { numRuns: 1000 }
    );
  });

  test('INV membership preserved (SameValueZero)', () => {
    fc.assert(
      fc.property(arrayArb, (arr) => {
        const out = dedupe(arr.slice());
        expect(svzSetEqual(svzSet(out), svzSet(arr))).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  test('INV output has no duplicates', () => {
    fc.assert(
      fc.property(arrayArb, (arr) => {
        const out = dedupe(arr.slice());
        expect(svzSet(out).size).toBe(out.length);
      }),
      { numRuns: 1000 }
    );
  });

  test('INV subsequence of input', () => {
    fc.assert(
      fc.property(arrayArb, (arr) => {
        const out = dedupe(arr.slice());
        expect(isSubsequence(out, arr)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });
});

// ---------------------------------------------------------------------------
// Bench-has-teeth: confirm the scoreboard FAILS when the reference model is
// mutated (off-by-one). This proves the checks are not vacuous. We do NOT touch
// the SUT — we run a deliberately-wrong model against the SUT and assert the
// element comparison disagrees on at least one input.
// ---------------------------------------------------------------------------
describe('dedupe — fault injection (bench self-test)', () => {
  test('a deliberately broken model disagrees with the SUT (checks have teeth)', () => {
    // Broken model: keeps LAST occurrence order (reverse-dedupe) instead of first.
    function brokenModel(arr: number[]): number[] {
      const out: number[] = [];
      const seen = new Set<number>();
      for (let i = arr.length - 1; i >= 0; i--) {
        if (!seen.has(arr[i])) {
          seen.add(arr[i]);
          out.unshift(arr[i]);
        }
      }
      // This reverses first-occurrence order in the presence of reordered dups.
      return out;
    }
    // On [1,2,2,3,1] the correct first-occurrence dedup is [1,2,3].
    // brokenModel yields order by last unique scan -> [2,3,1] (different).
    const probe = [1, 2, 2, 3, 1];
    const correct = dedupe(probe);
    const broken = brokenModel(probe);
    expect(svzArrayEqual(correct, broken)).toBe(false); // they MUST differ
  });
});

// ---------------------------------------------------------------------------
// Coverage closure gate (Phase F).
// ---------------------------------------------------------------------------
describe('dedupe — functional coverage closure', () => {
  test('all planned cover points were exercised', () => {
    // Drive a handful of directed inputs to guarantee closure of rare bins.
    [
      [],
      [7],
      [1, 2, 3, 4],
      [9, 9, 9, 9],
      [1, 2, 1, 3, 2],
      [0, 1, 2],
      [-0, 1, 2],
      [0, -0, 5],
      [NaN, 1],
      [NaN, NaN, 2],
      [NaN, 5, NaN, 6],
      [Infinity, 1],
      [-Infinity, 2],
      Array.from({ length: 60 }, (_, i) => i % 7),
      [3, 1, 2]
    ].forEach((a) => scoreboard(a as number[]));

    const holes = cov.unhit();
    if (holes.length) {
      throw new Error(`Unhit cover points: ${holes.join(', ')} | ${cov.report()}`);
    }
    expect(holes).toEqual([]);
  });
});
