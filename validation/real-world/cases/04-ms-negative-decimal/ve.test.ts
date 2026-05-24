// Independent VE testbench — derived ONLY from spec.md.
// Contract (string -> number direction): ms(str) parses a number + optional unit
// into milliseconds. Invariants: sign symmetry ms('-'+X) === -ms(X);
// decimal/integer parity (decimals with a multi-digit integer part parse the
// same way as single-digit ones); negatives accepted.
import { describe, test, expect } from 'vitest';
import ms from './sut';

const HOUR = 3600000;

describe('ms — documented golden values (string -> number)', () => {
  const cases: ReadonlyArray<readonly [string, number]> = [
    ['2 days', 172800000],
    ['1d', 86400000],
    ['10h', 36000000],
    ['2.5 hrs', 9000000],
    ['2h', 7200000],
    ['1m', 60000],
    ['5s', 5000],
    ['1y', 31557600000],
    ['100', 100],
    ['-3 days', -259200000],
    ['-1h', -3600000],
    ['-200', -200],
  ];
  for (const [str, expected] of cases) {
    test(`ms('${str}') === ${expected}`, () => {
      expect(ms(str)).toBe(expected);
    });
  }
});

describe('ms — decimal/integer parity (spec invariant)', () => {
  // Spec: "ms(d + unit) parses identically whether the decimal's integer part has
  // one digit or many — e.g. ms('1.5h') and ms('10.5h')".
  test("ms('1.5h') === 1.5 * 3600000", () => {
    expect(ms('1.5h')).toBe(1.5 * HOUR);
  });
  test("ms('10.5h') === 10.5 * 3600000", () => {
    expect(ms('10.5h')).toBe(10.5 * HOUR);
  });
  test("ms('100.5h') === 100.5 * 3600000", () => {
    expect(ms('100.5h')).toBe(100.5 * HOUR);
  });
  test("leading-dot decimal ms('.5h') === 0.5 * 3600000", () => {
    expect(ms('.5h')).toBe(0.5 * HOUR);
  });
});

describe('ms — sign symmetry: ms("-"+X) === -ms(X) (spec invariant)', () => {
  const positives = [
    '200',
    '100',
    '2h',
    '1h',
    '1.5h',
    '10.5h',
    '100.5h',
    '2.5 hrs',
    '3 days',
    '1d',
    '1y',
    '5s',
    '.5h',
  ];
  for (const x of positives) {
    test(`ms('-${x}') === -ms('${x}')`, () => {
      const pos = ms(x);
      // sanity: positive form parses to a finite number
      expect(Number.isFinite(pos)).toBe(true);
      expect(ms('-' + x)).toBe(-pos);
    });
  }
});

describe('ms — negative decimals with multi-digit integer part', () => {
  // The defining combination of the two invariants: negative + multi-digit
  // decimal. Derived purely from the golden unit scale + sign symmetry.
  test("ms('-10.5h') === -(10.5 * 3600000)", () => {
    expect(ms('-10.5h')).toBe(-(10.5 * HOUR));
  });
  test("ms('-100.5h') === -(100.5 * 3600000)", () => {
    expect(ms('-100.5h')).toBe(-(100.5 * HOUR));
  });
  test("ms('-2.5 hrs') === -9000000", () => {
    expect(ms('-2.5 hrs')).toBe(-9000000);
  });
});
