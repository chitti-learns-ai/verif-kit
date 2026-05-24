// IV&V verification environment for `addMonths` — case 09.
// INDEPENDENCE: authored from spec.md ONLY. sut.ts NEVER read.
// Components: independent from-spec reference model (golden), scoreboard,
// constrained-random generator (fast-check), functional coverage model,
// directed boundary-value corners, hand-derived worked examples,
// invariant assertions, malformed-input/error-path fuzz.

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { addMonths } from './sut';

// ---------------------------------------------------------------------------
// REFERENCE MODEL (golden) — written independently from the spec.
// Algorithm (per spec): target month index = (startMonth-1) + n, then
// decompose into year carry + month via integer floor-division. Clamp the
// day to min(startDay, daysInResultMonth). UTC calendar only.
// ---------------------------------------------------------------------------

const DAYS_IN_MONTH_COMMON = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month1: number): number {
  // month1 is 1..12
  if (month1 === 2 && isLeap(year)) return 29;
  return DAYS_IN_MONTH_COMMON[month1 - 1];
}

// Strict YYYY-MM-DD calendar-date parse. Returns null if malformed.
function parseIso(iso: unknown): { y: number; m: number; d: number } | null {
  if (typeof iso !== 'string') return null;
  // Exact shape: 4 digits - 2 digits - 2 digits, nothing else.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12) return null;
  if (d < 1) return null;
  if (d > daysInMonth(y, m)) return null; // e.g. 2021-02-30 is not a real date
  return { y, m, d };
}

function pad(n: number, width: number): string {
  const neg = n < 0;
  let s = Math.abs(n).toString();
  while (s.length < width) s = '0' + s;
  return neg ? '-' + s : s;
}

function fmt(y: number, m: number, d: number): string {
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

class ReferenceError_ extends Error {}

function refAddMonths(iso: string, n: number): string {
  const parsed = parseIso(iso);
  if (parsed === null) throw new ReferenceError_(`malformed iso: ${iso}`);
  if (!Number.isInteger(n)) throw new ReferenceError_(`non-integer n: ${n}`);

  const { y, m, d } = parsed;
  // Zero-based month index across the timeline, shifted by n.
  const monthIndex = (m - 1) + n;
  // floorDiv / floorMod so negatives wrap correctly.
  const targetYear = y + Math.floor(monthIndex / 12);
  const targetMonth1 = monthIndex - Math.floor(monthIndex / 12) * 12 + 1; // 1..12

  const targetDay = Math.min(d, daysInMonth(targetYear, targetMonth1));
  return fmt(targetYear, targetMonth1, targetDay);
}

// Monitor: extract structured observable facts from a SUT ISO string.
function observe(iso: string): { y: number; m: number; d: number } {
  const m2 = /^(-?\d+)-(\d{2})-(\d{2})$/.exec(iso);
  if (!m2) throw new Error(`SUT returned unparseable string: ${JSON.stringify(iso)}`);
  return { y: Number(m2[1]), m: Number(m2[2]), d: Number(m2[3]) };
}

// ---------------------------------------------------------------------------
// SCOREBOARD
// ---------------------------------------------------------------------------
interface Mismatch {
  iso: string;
  n: number;
  expected: string;
  actual: string;
  kind: 'value' | 'sut-threw' | 'ref-threw';
  detail?: string;
}

function compare(iso: string, n: number): Mismatch | null {
  let refOut: string | undefined;
  let refThrew = false;
  try {
    refOut = refAddMonths(iso, n);
  } catch {
    refThrew = true;
  }

  let sutOut: string | undefined;
  let sutThrew = false;
  let sutErr: unknown;
  try {
    sutOut = addMonths(iso, n);
  } catch (e) {
    sutThrew = true;
    sutErr = e;
  }

  if (refThrew && sutThrew) return null; // both reject — agreement on error path
  if (refThrew && !sutThrew) {
    return { iso, n, expected: '<throw>', actual: String(sutOut), kind: 'sut-threw', detail: 'SUT did not throw on input ref rejects' };
  }
  if (!refThrew && sutThrew) {
    return { iso, n, expected: String(refOut), actual: '<threw>', kind: 'ref-threw', detail: `SUT threw: ${String(sutErr)}` };
  }
  if (refOut !== sutOut) {
    return { iso, n, expected: String(refOut), actual: String(sutOut), kind: 'value' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// FUNCTIONAL COVERAGE MODEL
// ---------------------------------------------------------------------------
class CoverageModel {
  private bins = new Map<string, number>();
  constructor(private planned: string[]) {
    for (const p of planned) this.bins.set(p, 0);
  }
  cover(bin: string) {
    this.bins.set(bin, (this.bins.get(bin) ?? 0) + 1);
  }
  holes(): string[] {
    return this.planned.filter((p) => (this.bins.get(p) ?? 0) === 0);
  }
  closurePct(): number {
    const hit = this.planned.filter((p) => (this.bins.get(p) ?? 0) > 0).length;
    return (hit / this.planned.length) * 100;
  }
}

const PLANNED = [
  'day-exists-no-clamp',
  'clamp-31-to-feb-common',
  'clamp-31-to-feb-leap',
  'clamp-backward',
  'year-rollover-forward',
  'year-rollover-backward',
  'identity-n0',
  'multi-month-shift',
  'negative-n',
  'leap-feb29-start',
  'day-le-28-roundtrip',
  'large-positive-n',
  'large-negative-n',
  'month-with-30-days-clamp'
];
const cov = new CoverageModel(PLANNED);

function classify(p: { y: number; m: number; d: number }, n: number) {
  if (n === 0) cov.cover('identity-n0');
  if (n < 0) cov.cover('negative-n');
  if (n <= -12) cov.cover('large-negative-n');
  if (n >= 12) cov.cover('large-positive-n');
  if (Math.abs(n) >= 2 && Math.abs(n) < 12) cov.cover('multi-month-shift');
  if (p.d <= 28) cov.cover('day-le-28-roundtrip');
  if (p.m === 2 && p.d === 29) cov.cover('leap-feb29-start');
  const monthIndex = (p.m - 1) + n;
  const ty = p.y + Math.floor(monthIndex / 12);
  const tm = monthIndex - Math.floor(monthIndex / 12) * 12 + 1;
  const dim = daysInMonth(ty, tm);
  if (p.d <= dim) cov.cover('day-exists-no-clamp');
  if (p.d > dim) {
    if (tm === 2 && !isLeap(ty)) cov.cover('clamp-31-to-feb-common');
    else if (tm === 2 && isLeap(ty)) cov.cover('clamp-31-to-feb-leap');
    else if (dim === 30) cov.cover('month-with-30-days-clamp');
    if (n < 0) cov.cover('clamp-backward');
  }
  if (ty > p.y) cov.cover('year-rollover-forward');
  if (ty < p.y) cov.cover('year-rollover-backward');
}

// ===========================================================================
// PHASE: hand-derived worked examples (golden values from spec table).
// ===========================================================================
describe('worked examples (hand-derived from spec)', () => {
  const cases: Array<[string, number, string, string]> = [
    ['2021-01-15', 1, '2021-02-15', 'day exists'],
    ['2021-01-31', 1, '2021-02-28', 'Feb common-year → clamp 28'],
    ['2020-01-31', 1, '2020-02-29', '2020 leap → clamp 29'],
    ['2021-03-31', -1, '2021-02-28', 'clamp going backward'],
    ['2021-12-31', 1, '2022-01-31', 'year rollover; Jan has 31'],
    ['2021-05-20', 0, '2021-05-20', 'identity'],
    ['2021-10-31', -8, '2021-02-28', 'clamp after multi-month shift']
  ];
  for (const [iso, n, expected, why] of cases) {
    test(`addMonths("${iso}", ${n}) === "${expected}" (${why})`, () => {
      // Cross-check: reference model agrees with the hand value first.
      expect(refAddMonths(iso, n), 'ref model disagrees with hand-derived golden').toBe(expected);
      expect(addMonths(iso, n)).toBe(expected);
    });
  }
});

// ===========================================================================
// PHASE: directed boundary-value corners (month-end days, leap Feb, rollover).
// ===========================================================================
describe('directed boundary-value corners (scoreboard)', () => {
  const corners: Array<[string, number]> = [
    // 31st of every month shifted +1 (lands on shorter months / Feb)
    ['2021-01-31', 1], ['2021-03-31', 1], ['2021-05-31', 1], ['2021-07-31', 1],
    ['2021-08-31', 1], ['2021-10-31', 1], ['2021-12-31', 1],
    // 30-day month into 31-day and into Feb
    ['2021-04-30', 1], ['2021-04-30', -2], ['2021-06-30', -4],
    // Feb 29 leap start shifted by ±12 (lands on common-year Feb)
    ['2020-02-29', 12], ['2020-02-29', -12], ['2020-02-29', 48], ['2020-02-29', -48],
    // 29/30/31 into February both directions
    ['2019-01-29', 1], ['2019-01-30', 1], ['2019-01-31', 1],
    ['2019-03-31', -1], ['2019-03-30', -1], ['2019-03-29', -1],
    // year boundaries
    ['2021-12-31', 1], ['2021-12-31', -1], ['2022-01-31', -1], ['2022-01-01', -1],
    // large multi-year shifts
    ['2021-01-31', 13], ['2021-01-31', 25], ['2021-01-31', -13], ['2021-01-31', -25],
    ['2000-02-29', 1200], ['2000-02-29', -1200],
    // century non-leap (1900 not leap, 2000 leap)
    ['1900-01-31', 1], ['2000-01-31', 1],
    // identity & small
    ['2021-05-20', 0], ['2021-02-28', 12], ['2024-02-29', 12]
  ];
  for (const [iso, n] of corners) {
    test(`corner addMonths("${iso}", ${n})`, () => {
      const p = parseIso(iso)!;
      classify(p, n);
      const mm = compare(iso, n);
      expect(mm, mm ? `MISMATCH ${JSON.stringify(mm)}` : '').toBeNull();
    });
  }
});

// ===========================================================================
// PHASE: constrained-random scoreboard (DUT vs reference model).
// ===========================================================================
const isoArb = fc
  .record({
    y: fc.integer({ min: 1900, max: 2200 }),
    m: fc.integer({ min: 1, max: 12 })
  })
  .chain(({ y, m }) =>
    fc.record({
      y: fc.constant(y),
      m: fc.constant(m),
      d: fc.integer({ min: 1, max: daysInMonth(y, m) })
    })
  )
  .map(({ y, m, d }) => fmt(y, m, d));

const nArb = fc.integer({ min: -400, max: 400 });

describe('constrained-random scoreboard', () => {
  test('DUT === reference model over random (iso, n)', () => {
    fc.assert(
      fc.property(isoArb, nArb, (iso, n) => {
        const p = parseIso(iso)!;
        classify(p, n);
        const mm = compare(iso, n);
        if (mm) throw new Error(`MISMATCH ${JSON.stringify(mm)}`);
      }),
      { numRuns: 4000 }
    );
  });
});

// ===========================================================================
// PHASE: oracle-free invariant properties (spec invariants directly).
// ===========================================================================
describe('spec invariants (oracle-free properties)', () => {
  test('INV1 no-overflow: result month == (startMonth-1+n) mod 12 + 1 (with year carry)', () => {
    fc.assert(
      fc.property(isoArb, nArb, (iso, n) => {
        const p = parseIso(iso)!;
        const out = addMonths(iso, n);
        const o = observe(out);
        const monthIndex = (p.m - 1) + n;
        const expectMonth = ((monthIndex % 12) + 12) % 12 + 1;
        const expectYear = p.y + Math.floor(monthIndex / 12);
        expect(o.m).toBe(expectMonth);
        expect(o.y).toBe(expectYear);
        // day never spills into next month
        expect(o.d).toBeGreaterThanOrEqual(1);
        expect(o.d).toBeLessThanOrEqual(daysInMonth(o.y, o.m));
      }),
      { numRuns: 3000 }
    );
  });

  test('INV2 day <= min(startDay, daysInResultMonth); == startDay when room exists', () => {
    fc.assert(
      fc.property(isoArb, nArb, (iso, n) => {
        const p = parseIso(iso)!;
        const out = addMonths(iso, n);
        const o = observe(out);
        const dim = daysInMonth(o.y, o.m);
        expect(o.d).toBeLessThanOrEqual(Math.min(p.d, dim));
        if (dim >= p.d) expect(o.d).toBe(p.d);
      }),
      { numRuns: 3000 }
    );
  });

  test('INV3 round-trip for startDay <= 28', () => {
    const isoArb28 = fc
      .record({ y: fc.integer({ min: 1900, max: 2200 }), m: fc.integer({ min: 1, max: 12 }) })
      .chain(({ y, m }) =>
        fc.record({ y: fc.constant(y), m: fc.constant(m), d: fc.integer({ min: 1, max: 28 }) })
      )
      .map(({ y, m, d }) => fmt(y, m, d));
    fc.assert(
      fc.property(isoArb28, nArb, (iso, n) => {
        const round = addMonths(addMonths(iso, n), -n);
        expect(round).toBe(iso);
      }),
      { numRuns: 3000 }
    );
  });

  test('INV4 monotonic: increasing n never moves result earlier', () => {
    fc.assert(
      fc.property(isoArb, nArb, fc.integer({ min: 0, max: 50 }), (iso, n, delta) => {
        const a = addMonths(iso, n);
        const b = addMonths(iso, n + delta);
        // compare as date strings -> lexical order works for zero-padded YYYY-MM-DD
        const oa = observe(a);
        const ob = observe(b);
        const ka = oa.y * 10000 + oa.m * 100 + oa.d;
        const kb = ob.y * 10000 + ob.m * 100 + ob.d;
        expect(kb).toBeGreaterThanOrEqual(ka);
      }),
      { numRuns: 3000 }
    );
  });

  test('metamorphic: additivity addMonths(addMonths(d,a),b) == addMonths(d,a+b) for day<=28', () => {
    const isoArb28 = fc
      .record({ y: fc.integer({ min: 1950, max: 2100 }), m: fc.integer({ min: 1, max: 12 }) })
      .chain(({ y, m }) =>
        fc.record({ y: fc.constant(y), m: fc.constant(m), d: fc.integer({ min: 1, max: 28 }) })
      )
      .map(({ y, m, d }) => fmt(y, m, d));
    fc.assert(
      fc.property(isoArb28, fc.integer({ min: -100, max: 100 }), fc.integer({ min: -100, max: 100 }), (iso, a, b) => {
        expect(addMonths(addMonths(iso, a), b)).toBe(addMonths(iso, a + b));
      }),
      { numRuns: 2000 }
    );
  });
});

// ===========================================================================
// PHASE: error paths / adversarial malformed input fuzz.
// ===========================================================================
describe('error paths (must throw, never return malformed silently)', () => {
  const badInputs: Array<[unknown, number]> = [
    ['2021-13-01', 1],   // month 13
    ['2021-00-10', 1],   // month 0
    ['2021-02-30', 1],   // Feb 30 not real
    ['2021-02-29', 1],   // 2021 not leap → Feb 29 not real
    ['2021-04-31', 1],   // Apr has 30
    ['2021-1-15', 1],    // not zero-padded
    ['2021-01-5', 1],    // not zero-padded
    ['2021/01/15', 1],   // wrong separator
    ['not-a-date', 1],   // garbage
    ['', 1],             // empty
    ['2021-01-15T00:00:00Z', 1], // has time component
    ['2021-01-15 ', 1],  // trailing space
    ['20210115', 1]      // no separators
  ];
  for (const [iso, n] of badInputs) {
    test(`throws on malformed iso ${JSON.stringify(iso)}`, () => {
      // sanity: reference model also rejects
      expect(() => refAddMonths(iso as string, n)).toThrow();
      expect(() => addMonths(iso as string, n)).toThrow();
    });
  }

  const badN: number[] = [1.5, -0.5, 0.1, NaN, Infinity, -Infinity, 2.0000001];
  for (const n of badN) {
    test(`throws on non-integer n = ${n}`, () => {
      expect(() => refAddMonths('2021-01-15', n)).toThrow();
      expect(() => addMonths('2021-01-15', n)).toThrow();
    });
  }
});

// ===========================================================================
// PHASE: error-path FUZZ — random malformed strings must never silently
// produce a valid-looking output; whenever the ref model rejects, SUT must too.
// ===========================================================================
describe('error-path fuzz', () => {
  test('SUT and ref agree on accept/reject for arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: -50, max: 50 }), (s, n) => {
        const mm = compare(s, n);
        if (mm) throw new Error(`accept/reject divergence ${JSON.stringify(mm)}`);
      }),
      { numRuns: 3000 }
    );
  });
});

// ===========================================================================
// PHASE F: coverage closure gate.
// ===========================================================================
describe('coverage closure', () => {
  test('all planned functional cover points hit', () => {
    const holes = cov.holes();
    expect(holes, `coverage holes: ${holes.join(', ')} (closure ${cov.closurePct().toFixed(1)}%)`).toEqual([]);
  });
});
