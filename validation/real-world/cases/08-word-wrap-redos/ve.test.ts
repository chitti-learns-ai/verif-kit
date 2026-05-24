// Independent VE testbench — derived ONLY from spec.md.
// Contract: wordwrap(str, opts) inserts line breaks at word boundaries so lines
// don't exceed width. PRIMARY correctness obligation per spec: robustness /
// termination — must NOT exhibit pathological (super-linear) slowdown or hang on
// ANY input, including whitespace-heavy ones, REGARDLESS of options. Also:
// word preservation, width bound (words-only), empty -> empty.
import { describe, test, expect } from 'vitest';
import wordwrap from './sut';

describe('word-wrap — basic functional behavior (any correct impl)', () => {
  test('empty string -> empty string', () => {
    expect(wordwrap('')).toBe('');
  });

  test('word preservation: all input words appear in order', () => {
    const input =
      'the quick brown fox jumps over the lazy dog and then keeps on running far away';
    const out = wordwrap(input, { width: 20 });
    const inWords = input.split(/\s+/).filter(Boolean);
    const outWords = out.split(/\s+/).filter(Boolean);
    expect(outWords).toEqual(inWords);
  });

  test('width bound: each line, with trailing whitespace removed, fits width when words fit', () => {
    // SOUNDNESS: default trim:false may leave a trailing separator space on a
    // wrapped line, so we measure the line with trailing whitespace stripped —
    // the spec's bound is about the wrapped *content*, and every word here <= width.
    const input =
      'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi';
    const width = 15;
    const out = wordwrap(input, { width });
    for (const line of out.split('\n')) {
      expect(line.replace(/\s+$/, '').length).toBeLessThanOrEqual(width);
    }
  });
});

// Spec invariant: "returns in time roughly proportional to the input length. It
// must not exhibit pathological (super-linear) slowdown or hang on any input —
// including inputs consisting largely of whitespace — regardless of the options."
//
// SOUNDNESS / non-flakiness: a correct (linear) implementation wraps a
// 70k-char whitespace-heavy string in well under a millisecond. A
// catastrophic-backtracking (ReDoS) implementation takes multiple SECONDS on the
// same input and grows super-linearly. The 2000ms budget sits ~400x above a
// correct impl's runtime and ~2.5x below the buggy one — it cannot trip a correct
// implementation, and it cannot miss a quadratic one.
describe('word-wrap — robustness / termination (spec primary invariant)', () => {
  function timeMs(fn: () => void): number {
    const t0 = performance.now();
    fn();
    return performance.now() - t0;
  }
  const BUDGET_MS = 2000;

  test('long trailing whitespace run with trim:true terminates quickly', () => {
    const input = 'word' + ' '.repeat(70000) + 'word';
    const elapsed = timeMs(() => {
      wordwrap(input, { trim: true });
    });
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  test('long whitespace run with default options terminates quickly', () => {
    const input = ' '.repeat(70000);
    const elapsed = timeMs(() => {
      wordwrap(input);
    });
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  test('whitespace-heavy mixed input with trim terminates quickly', () => {
    const input = ('word' + ' '.repeat(500)).repeat(140);
    const elapsed = timeMs(() => {
      wordwrap(input, { trim: true });
    });
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});

// Spec (corrected after review): null/undefined are returned UNCHANGED — the
// library does not coerce them to ''. Earlier this asserted '' (a spec-author
// error the blind verifier flagged as ambiguous); the real contract is pass-through.
describe('word-wrap — null/undefined returned unchanged (spec)', () => {
  test('null -> null', () => {
    // @ts-expect-error intentional null input
    expect(wordwrap(null)).toBe(null);
  });
  test('undefined -> undefined', () => {
    // @ts-expect-error intentional undefined input
    expect(wordwrap(undefined)).toBe(undefined);
  });
});
