// Independent VE testbench — derived ONLY from spec.md.
// Contract: parseMilliseconds(ms) decomposes a finite duration into
// {days,hours,minutes,seconds,milliseconds,microseconds,nanoseconds}, each
// truncated toward zero. Invariants: every field finite (never NaN/Infinity for
// any finite input, no matter how large); sub-unit ranges; reassembly.
import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import parseMilliseconds from './sut';

const FIELDS = [
  'days',
  'hours',
  'minutes',
  'seconds',
  'milliseconds',
  'microseconds',
  'nanoseconds',
] as const;

describe('parse-ms — documented golden example', () => {
  test('parseMilliseconds(1337000001)', () => {
    expect(parseMilliseconds(1337000001)).toEqual({
      days: 15,
      hours: 11,
      minutes: 23,
      seconds: 20,
      milliseconds: 1,
      microseconds: 0,
      nanoseconds: 0,
    });
  });
});

describe('parse-ms — every field is a finite number (spec invariant)', () => {
  // Spec: "never returns NaN, Infinity, or -Infinity in any field, for any finite
  // numeric input — no matter how large the duration." Probe large magnitudes.
  const inputs = [
    0,
    1,
    999,
    1000,
    1337000001,
    86400000, // one day
    Number.MAX_SAFE_INTEGER, // ~9e15 ms ~ 100k+ years
    1e15,
    1e12,
    9999999999999, // ~317 years
    1e300, // extreme finite magnitude
    Number.MAX_VALUE, // the largest finite double — overflow-prone products (ms*1e6) go non-finite here
  ];
  for (const ms of inputs) {
    test(`all fields finite for input=${ms}`, () => {
      const r = parseMilliseconds(ms) as Record<string, number>;
      for (const f of FIELDS) {
        expect(Number.isFinite(r[f])).toBe(true);
        expect(Number.isNaN(r[f])).toBe(false);
      }
    });
  }
});

describe('parse-ms — sub-unit ranges and integrality (spec invariant)', () => {
  const inputs = [0, 1, 999, 1000, 59999, 1337000001, Number.MAX_SAFE_INTEGER, 1e15];
  for (const ms of inputs) {
    test(`ranges for input=${ms}`, () => {
      const r = parseMilliseconds(ms) as Record<string, number>;
      for (const f of FIELDS) {
        expect(Number.isInteger(r[f])).toBe(true);
      }
      expect(Math.abs(r.hours!)).toBeLessThan(24);
      expect(Math.abs(r.minutes!)).toBeLessThan(60);
      expect(Math.abs(r.seconds!)).toBeLessThan(60);
      expect(Math.abs(r.milliseconds!)).toBeLessThan(1000);
      expect(Math.abs(r.microseconds!)).toBeLessThan(1000);
      expect(Math.abs(r.nanoseconds!)).toBeLessThan(1000);
    });
  }
});

// Independent reference model from the spec's "natural breakdown", truncating
// toward zero, computed with EXACT integer arithmetic on safe integers. For an
// integer-ms input this gives microseconds === nanoseconds === 0, and the
// reassembled whole-ms equals the input. NOTE: exact sub-millisecond
// decomposition is only representable in IEEE-754 while the implied product
// ms*1e6 stays below 2^53 (|ms| < ~9e9). Above that, NO float implementation can
// keep sub-ms exact, so the property below is bounded to that domain to remain
// sound for any spec-correct implementation. (Separately, the finiteness probe
// above pins the spec's "never non-finite for any finite input" at MAX_VALUE.)
function refDecompose(ms: number) {
  let r = Math.trunc(ms); // whole-ms part; inputs here are integers
  const days = Math.trunc(r / 86400000);
  r -= days * 86400000;
  const hours = Math.trunc(r / 3600000);
  r -= hours * 3600000;
  const minutes = Math.trunc(r / 60000);
  r -= minutes * 60000;
  const seconds = Math.trunc(r / 1000);
  r -= seconds * 1000;
  const milliseconds = r;
  return { days, hours, minutes, seconds, milliseconds, microseconds: 0, nanoseconds: 0 };
}

describe('parse-ms — reassembly reconstructs the truncated duration', () => {
  test('property: integer-ms input matches exact integer reference (incl. large)', () => {
    fc.assert(
      fc.property(
        // bounded to the float-exact sub-ms domain (ms*1e6 < 2^53); spans up to
        // ~104 days at ms granularity. Beyond this no float impl is sub-ms exact.
        fc.integer({ min: 0, max: 8_000_000_000 }),
        (ms) => {
          const r = parseMilliseconds(ms) as Record<string, number>;
          const ref = refDecompose(ms) as Record<string, number>;
          for (const f of FIELDS) {
            expect(r[f]).toBe(ref[f]);
          }
          // reassembly of the whole-ms fields equals the input exactly
          const reassembled =
            r.days! * 86400000 +
            r.hours! * 3600000 +
            r.minutes! * 60000 +
            r.seconds! * 1000 +
            r.milliseconds!;
          expect(reassembled).toBe(ms);
        }
      ),
      { numRuns: 300 }
    );
  });

  test('sub-millisecond decomposition (fractional ms input)', () => {
    // 1.234567 ms => 1 ms, 234 microseconds, 567 nanoseconds (truncated)
    const r = parseMilliseconds(1.234567) as Record<string, number>;
    expect(r.milliseconds).toBe(1);
    expect(r.microseconds).toBe(234);
    expect(r.nanoseconds).toBe(567);
  });
});

describe('parse-ms — non-number throws TypeError (spec error contract)', () => {
  test('string argument throws', () => {
    // @ts-expect-error intentional bad input
    expect(() => parseMilliseconds('100')).toThrow();
  });
});
