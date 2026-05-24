// Independent VE testbench — derived ONLY from spec.md.
// Contract: semverRegex() returns a fresh global, case-insensitive RegExp that
// matches SemVer versions in text. Defining property: the matched substring is
// the ENTIRE version token, INCLUDING pre-release and build-metadata parts — not
// just MAJOR.MINOR.PATCH.
import { describe, test, expect } from 'vitest';
import semverRegex from './sut';

describe('semver-regex — documented worked examples', () => {
  test("test('v1.0.0') is true", () => {
    expect(semverRegex().test('v1.0.0')).toBe(true);
  });
  test('test of full pre-release+build is true', () => {
    expect(
      semverRegex().test('1.2.3-alpha.10.beta.0+build.unicorn.rainbow')
    ).toBe(true);
  });
  test("exec('unicorn 1.0.0 rainbow')[0] === '1.0.0'", () => {
    const m = semverRegex().exec('unicorn 1.0.0 rainbow');
    expect(m).not.toBeNull();
    expect(m![0]).toBe('1.0.0');
  });
  test("'unicorn 1.0.0 and rainbow 2.1.3'.match(...) === ['1.0.0','2.1.3']", () => {
    expect('unicorn 1.0.0 and rainbow 2.1.3'.match(semverRegex())).toEqual([
      '1.0.0',
      '2.1.3',
    ]);
  });
});

describe('semver-regex — full-token capture (defining invariant)', () => {
  // Spec: for any valid SemVer string v, v.match(semverRegex())[0] === v.
  // In particular a pre-release/build suffix must NOT be truncated to the core.
  const validVersions = [
    '1.0.0',
    '10.20.30',
    '1.2.3-alpha',
    '1.2.3-alpha.10.beta.0+build.unicorn.rainbow',
    '1.0.0-rc.1',
    '1.0.0-0',
    '1.0.0+asdf',
    '1.0.0+build.1848',
    '1.0.0-alpha+001',
    '1.2.3-alpha.10.beta.0',
    '2.1.3',
  ];
  for (const v of validVersions) {
    test(`'${v}'.match()[0] === '${v}' (no truncation)`, () => {
      const m = v.match(semverRegex());
      expect(m).not.toBeNull();
      expect(m![0]).toBe(v);
    });
  }
});

describe('semver-regex — test() agrees with match() on standalone versions', () => {
  const versions = [
    '1.2.3-alpha.10.beta.0+build.unicorn.rainbow',
    '1.0.0-rc.1',
    '1.0.0+build.1848',
  ];
  for (const v of versions) {
    test(`agreement for '${v}'`, () => {
      if (semverRegex().test(v)) {
        const m = v.match(semverRegex());
        expect(m).not.toBeNull();
        expect(m![0]).toBe(v);
      }
    });
  }
});

describe('semver-regex — fresh, independent state per call (spec)', () => {
  test('two regexes do not share lastIndex', () => {
    const a = semverRegex();
    const b = semverRegex();
    expect(a).not.toBe(b);
    // both can match the same string independently
    expect('1.0.0'.match(a)).toEqual(['1.0.0']);
    expect('1.0.0'.match(b)).toEqual(['1.0.0']);
  });
});
