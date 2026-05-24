// Independent verification environment for `toRoman` (Integer -> Roman numeral).
// Authored from spec.md + the public signature ONLY. The VE never reads impl.*.ts.
//
// Lenses:
//   - Independent reference model (my own greedy from-spec converter)
//   - Oracle-free round-trip via my own independent Roman PARSER: parse(toRoman(n)) === n
//   - Canonical-form invariants (no symbol 4+ in a row; only legal tokens)
//   - Hand-derived worked examples (the spec table is authoritative)
//   - Error paths (out of range, non-integer, NaN, Infinity)
//   - Constrained-random over the full domain 1..3999 + exhaustive sweep

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { toRoman } from './sut';

// ---------------------------------------------------------------------------
// Reference model #1 — independent greedy converter (golden), written from spec.
// Standard value/symbol table including the six subtractive pairs.
// ---------------------------------------------------------------------------
const TABLE: ReadonlyArray<[number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I']
];

function refToRoman(n: number): string {
  let rem = n;
  let out = '';
  for (const [val, sym] of TABLE) {
    while (rem >= val) {
      out += sym;
      rem -= val;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Independent ORACLE — my own Roman PARSER (string -> int), oracle-free relation.
// Implements standard subtractive parsing: when a smaller value precedes a
// larger one, subtract it; otherwise add. This is fully independent of the SUT.
// ---------------------------------------------------------------------------
const SYMBOL_VALUE: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000
};

function parseRoman(s: string): number {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = SYMBOL_VALUE[s[i]];
    if (cur === undefined) {
      throw new Error(`parseRoman: invalid symbol '${s[i]}' in '${s}'`);
    }
    const next = i + 1 < s.length ? SYMBOL_VALUE[s[i + 1]] : 0;
    if (cur < next) total -= cur;
    else total += cur;
  }
  return total;
}

// Canonical-form predicate, derived independently from spec invariants.
// Returns null if canonical, else a human-readable reason.
const CANONICAL_TOKEN = /^(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
function canonicalViolation(s: string): string | null {
  if (s.length === 0) return 'empty string';
  if (!/^[IVXLCDM]+$/.test(s)) return `contains non-Roman character(s)`;
  // No symbol repeated 4+ times in a row (spec invariant).
  if (/(.)\1\1\1/.test(s)) return `symbol repeated 4+ times in a row`;
  // Strict canonical grammar (also forbids e.g. VV, LL, DD, IIV, etc.).
  if (!CANONICAL_TOKEN.test(s)) return `not the unique canonical form`;
  return null;
}

// ---------------------------------------------------------------------------
// Phase: worked examples (hand-derived from the spec table — authoritative).
// ---------------------------------------------------------------------------
const WORKED: ReadonlyArray<[number, string]> = [
  [1, 'I'],
  [3, 'III'],
  [4, 'IV'],
  [9, 'IX'],
  [14, 'XIV'],
  [40, 'XL'],
  [90, 'XC'],
  [400, 'CD'],
  [944, 'CMXLIV'],
  [1994, 'MCMXCIV'],
  [2023, 'MMXXIII'],
  [3999, 'MMMCMXCIX']
];

describe('toRoman — worked examples (spec table)', () => {
  for (const [n, expected] of WORKED) {
    test(`toRoman(${n}) === '${expected}'`, () => {
      expect(toRoman(n)).toBe(expected);
    });
  }
});

// Sanity: my own reference model must reproduce the spec's worked examples,
// otherwise my oracle is wrong (not the SUT).
describe('self-check: reference model reproduces spec worked examples', () => {
  for (const [n, expected] of WORKED) {
    test(`refToRoman(${n}) === '${expected}'`, () => {
      expect(refToRoman(n)).toBe(expected);
    });
  }
  test('parser round-trips my own reference model over full range', () => {
    for (let n = 1; n <= 3999; n++) {
      expect(parseRoman(refToRoman(n))).toBe(n);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase: EXHAUSTIVE sweep 1..3999. The domain is small enough to test fully,
// which gives a definitive verdict rather than a sampled one.
//   - scoreboard: DUT vs independent reference model
//   - oracle-free: parse(toRoman(n)) === n
//   - canonical-form invariant
// ---------------------------------------------------------------------------
describe('toRoman — exhaustive 1..3999', () => {
  test('matches independent reference model for every n', () => {
    const mismatches: Array<{ n: number; dut: string; ref: string }> = [];
    for (let n = 1; n <= 3999; n++) {
      const dut = toRoman(n);
      const ref = refToRoman(n);
      if (dut !== ref) mismatches.push({ n, dut, ref });
    }
    expect(mismatches.slice(0, 25)).toEqual([]);
    expect(mismatches.length).toBe(0);
  });

  test('round-trips through independent parser for every n', () => {
    const failures: Array<{ n: number; dut: string; parsed: number }> = [];
    for (let n = 1; n <= 3999; n++) {
      const dut = toRoman(n);
      let parsed: number;
      try {
        parsed = parseRoman(dut);
      } catch (e) {
        failures.push({ n, dut, parsed: NaN });
        continue;
      }
      if (parsed !== n) failures.push({ n, dut, parsed });
    }
    expect(failures.slice(0, 25)).toEqual([]);
    expect(failures.length).toBe(0);
  });

  test('every output is in canonical form', () => {
    const violations: Array<{ n: number; dut: string; why: string }> = [];
    for (let n = 1; n <= 3999; n++) {
      const dut = toRoman(n);
      const why = canonicalViolation(dut);
      if (why) violations.push({ n, dut, why });
    }
    expect(violations.slice(0, 25)).toEqual([]);
    expect(violations.length).toBe(0);
  });

  test('output uses only legal Roman symbols and is non-empty', () => {
    const bad: Array<{ n: number; dut: string }> = [];
    for (let n = 1; n <= 3999; n++) {
      const dut = toRoman(n);
      if (typeof dut !== 'string' || dut.length === 0 || !/^[IVXLCDM]+$/.test(dut)) {
        bad.push({ n, dut });
      }
    }
    expect(bad.slice(0, 25)).toEqual([]);
    expect(bad.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Phase: constrained-random properties (fast-check) over the legal domain.
// Redundant with the exhaustive sweep but exercises the property harness and
// surfaces minimal counterexamples via shrinking.
// ---------------------------------------------------------------------------
const validN = fc.integer({ min: 1, max: 3999 });

describe('toRoman — properties (constrained-random)', () => {
  test('round-trip parse(toRoman(n)) === n', () => {
    fc.assert(
      fc.property(validN, (n) => {
        expect(parseRoman(toRoman(n))).toBe(n);
      }),
      { numRuns: 5000 }
    );
  });

  test('agrees with reference model', () => {
    fc.assert(
      fc.property(validN, (n) => {
        expect(toRoman(n)).toBe(refToRoman(n));
      }),
      { numRuns: 5000 }
    );
  });

  test('output is canonical', () => {
    fc.assert(
      fc.property(validN, (n) => {
        expect(canonicalViolation(toRoman(n))).toBeNull();
      }),
      { numRuns: 5000 }
    );
  });

  // Metamorphic: appending one unit's worth either extends or keeps length
  // monotonic in value via parser (oracle-free ordering check).
  test('parsed value is strictly increasing across the domain (monotonic)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3998 }),
        (n) => {
          expect(parseRoman(toRoman(n + 1))).toBeGreaterThan(parseRoman(toRoman(n)));
        }
      ),
      { numRuns: 5000 }
    );
  });
});

// ---------------------------------------------------------------------------
// Phase: error / boundary paths. Spec: n outside 1..3999 or non-integer MUST
// throw an Error (never return malformed/empty string).
// ---------------------------------------------------------------------------
describe('toRoman — error paths (must throw, never silent)', () => {
  const mustThrow: Array<[string, number]> = [
    ['0', 0],
    ['-1', -1],
    ['-1000', -1000],
    ['4000', 4000],
    ['5000', 5000],
    ['3.5 (non-integer)', 3.5],
    ['0.5', 0.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['1.0000001', 1.0000001]
  ];

  for (const [label, n] of mustThrow) {
    test(`toRoman(${label}) throws Error`, () => {
      expect(() => toRoman(n)).toThrow(Error);
    });
  }

  test('boundary 1 and 3999 do NOT throw', () => {
    expect(() => toRoman(1)).not.toThrow();
    expect(() => toRoman(3999)).not.toThrow();
  });

  // Random out-of-range and non-integer inputs must all throw.
  test('random out-of-range integers throw', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -100000, max: 0 }),
          fc.integer({ min: 4000, max: 100000 })
        ),
        (n) => {
          expect(() => toRoman(n)).toThrow();
        }
      ),
      { numRuns: 2000 }
    );
  });

  test('random non-integers in range throw', () => {
    fc.assert(
      fc.property(
        fc
          .double({ min: 1, max: 3999, noNaN: true })
          .filter((x) => !Number.isInteger(x)),
        (x) => {
          expect(() => toRoman(x)).toThrow();
        }
      ),
      { numRuns: 2000 }
    );
  });
});
