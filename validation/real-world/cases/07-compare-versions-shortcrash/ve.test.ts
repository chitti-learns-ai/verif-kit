// Independent VE testbench — derived ONLY from spec.md.
// Contract: compareVersions(v1,v2) -> -1|0|1 comparing semver strings, supporting
// different numbers of segments (1, 1.0, 1.0.0 all comparable; shorter padded
// with zeros) and pre-release suffixes. Invariants: totality (never throws for a
// documented well-formed version), reflexive equality, antisymmetry, padding.
import { describe, test, expect } from 'vitest';
import compareVersions from './sut';

describe('compare-versions — documented worked expectations', () => {
  const cases: ReadonlyArray<readonly [string, string, number]> = [
    ['10.1.8', '10.0.4', 1],
    ['10.0.1', '10.0.1', 0],
    ['10.1.1', '10.2.2', -1],
    ['10', '9', 1],
    ['10', '10', 0],
    ['9', '10', -1],
    ['10.8', '10.4', 1],
    ['1.0', '1.0.0', 0],
    ['1', '1', 0],
  ];
  for (const [a, b, exp] of cases) {
    test(`compareVersions('${a}','${b}') === ${exp}`, () => {
      expect(compareVersions(a, b)).toBe(exp);
    });
  }
});

describe('compare-versions — totality / no crashes on short forms (spec invariant)', () => {
  // Spec: "It never throws for a documented, well-formed version — including equal
  // single-segment or two-segment versions." Exercise short equal pairs.
  const versions = ['1', '9', '10', '1.0', '10.8', '1.0.0', '10.1.8', '1.0.0-alpha'];
  for (const v of versions) {
    test(`returns -1|0|1 (no throw) for compareVersions('${v}','${v}')`, () => {
      let r: number | undefined;
      expect(() => {
        r = compareVersions(v, v);
      }).not.toThrow();
      expect([-1, 0, 1]).toContain(r);
    });
  }
});

describe('compare-versions — reflexive equality (spec invariant)', () => {
  const versions = ['1', '9', '10', '1.0', '10.8', '1.0.0', '10.1.8', '1.0.0-alpha', '2.5'];
  for (const v of versions) {
    test(`compareVersions('${v}','${v}') === 0`, () => {
      expect(compareVersions(v, v)).toBe(0);
    });
  }
});

describe('compare-versions — segment padding (spec invariant)', () => {
  // A version with fewer segments == zeros in missing positions.
  const equalPairs: ReadonlyArray<readonly [string, string]> = [
    ['1', '1.0.0'],
    ['1', '1.0'],
    ['1.0', '1.0.0'],
    ['10', '10.0'],
    ['10', '10.0.0'],
  ];
  for (const [a, b] of equalPairs) {
    test(`'${a}' ≡ '${b}'`, () => {
      expect(compareVersions(a, b)).toBe(0);
      expect(compareVersions(b, a)).toBe(0);
    });
  }
});

describe('compare-versions — antisymmetry (spec invariant)', () => {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ['10.1.8', '10.0.4'],
    ['10', '9'],
    ['9', '10'],
    ['10.8', '10.4'],
    ['1.0.0', '1.0.1'],
    ['2', '1.9.9'],
    ['1.0.0-alpha', '1.0.0'],
  ];
  for (const [a, b] of pairs) {
    test(`opposite signs for ('${a}','${b}')`, () => {
      const ab = compareVersions(a, b);
      const ba = compareVersions(b, a);
      expect(ab).toBe(-ba);
    });
  }
});

describe('compare-versions — usable as a sort comparator (documented)', () => {
  test("['1.5.19','1.2.3','1.5.5'].sort => ['1.2.3','1.5.5','1.5.19']", () => {
    expect(['1.5.19', '1.2.3', '1.5.5'].slice().sort(compareVersions)).toEqual([
      '1.2.3',
      '1.5.5',
      '1.5.19',
    ]);
  });
});
