// Independent VE testbench — derived ONLY from spec.md.
// Contract: plural/singular convert English nouns; singular(plural(s)) === s for
// ordinary nouns; -sis/-ses Greco-Latin words round-trip; idempotence of form;
// isPlural/isSingular are duals of the transforms.
import { describe, test, expect } from 'vitest';
import { plural, singular, isPlural, isSingular } from './sut';

describe('pluralize — documented worked examples (golden, from spec table)', () => {
  test('plural() golden values', () => {
    expect(plural('test')).toBe('tests');
    expect(plural('regex')).toBe('regexes');
    expect(plural('apple')).toBe('apples');
  });
  test('singular() golden values', () => {
    expect(singular('singles')).toBe('single');
    expect(singular('apples')).toBe('apple');
  });
});

// Spec invariant: "Singular/plural inverse on regular nouns" — round-trip.
// Spec stresses "both short common nouns and longer compound/derived nouns".
const regularNouns = [
  'apple',
  'test',
  'car',
  'book',
  'table',
  'house',
  'dog',
  'cat',
  // longer / compound / derived nouns built from common bases:
  'database',
  'keyboard',
  'notebook',
  'bookcase',
  'firetruck',
  'snowflake',
  'paperclip',
  'doorknob',
];

describe('pluralize — singular/plural inverse round-trip (spec invariant)', () => {
  for (const s of regularNouns) {
    test(`singular(plural("${s}")) === "${s}"`, () => {
      const p = plural(s);
      // Spec scopes the round-trip to nouns whose plural differs from the singular.
      if (p !== s) {
        expect(singular(p)).toBe(s);
      }
    });
  }
});

describe('pluralize — Greco-Latin -sis/-ses round-trip (spec invariant)', () => {
  const sisPairs: ReadonlyArray<readonly [string, string]> = [
    ['analysis', 'analyses'],
    ['diagnosis', 'diagnoses'],
    ['thesis', 'theses'],
    ['crisis', 'crises'],
  ];
  for (const [sg, pl] of sisPairs) {
    test(`"${sg}" <-> "${pl}"`, () => {
      expect(plural(sg)).toBe(pl);
      expect(singular(pl)).toBe(sg);
      // round-trip
      expect(singular(plural(sg))).toBe(sg);
      expect(plural(singular(pl))).toBe(pl);
    });
  }
});

describe('pluralize — irregular forms named by the spec', () => {
  const irregulars: ReadonlyArray<readonly [string, string]> = [
    ['child', 'children'],
    ['mouse', 'mice'],
    ['index', 'indices'],
  ];
  for (const [sg, pl] of irregulars) {
    test(`"${sg}" <-> "${pl}"`, () => {
      expect(plural(sg)).toBe(pl);
      expect(singular(pl)).toBe(sg);
    });
  }
});

describe('pluralize — idempotence of form (spec invariant)', () => {
  for (const s of regularNouns) {
    test(`plural is form-stable for "${s}"`, () => {
      const p = plural(s);
      expect(plural(p)).toBe(p);
    });
    test(`singular is form-stable for "${s}"`, () => {
      const sg = singular(s);
      expect(singular(sg)).toBe(sg);
    });
  }
});

describe('pluralize — isSingular/isPlural are duals of the transforms (spec)', () => {
  // Spec: isSingular(word) is true iff singular(word) === word; isPlural is the dual.
  const words = [...regularNouns, 'apples', 'tests', 'children', 'mice', 'analyses'];
  for (const w of words) {
    test(`isSingular("${w}") matches singular()===self`, () => {
      expect(isSingular(w)).toBe(singular(w) === w);
    });
    test(`isPlural("${w}") matches plural()===self`, () => {
      expect(isPlural(w)).toBe(plural(w) === w);
    });
  }
});
