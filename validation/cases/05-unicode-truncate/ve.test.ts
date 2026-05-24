// Independent Verification Engineer environment — case 05 unicode-truncate.
// Authored WITHOUT reading sut.ts or any oracle. Behavior derived solely from
// cases/05-unicode-truncate/spec.md.
//
// Strategy: this spec is about Unicode correctness; a naive reference model
// (.slice/.length) would SHARE any UTF-16 bug. So checks are predominantly
// ORACLE-FREE (metamorphic / validity / structural), plus hand-derived golden
// examples and error paths. No scoreboard against a "second slice".
import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { truncate } from './sut';

// ---------------------------------------------------------------------------
// Oracle-free helpers (these describe Unicode TRUTH, not the SUT's algorithm).
// ---------------------------------------------------------------------------

/** Count of Unicode code points (astral chars count as 1). */
function codePointLength(s: string): number {
  return [...s].length;
}

/** Array of code points (each as a single-code-point string). */
function codePoints(s: string): string[] {
  return [...s];
}

/**
 * Well-formed UTF-16 check: scan code units. A high surrogate (0xD800-0xDBFF)
 * must be immediately followed by a low surrogate (0xDC00-0xDFFF); a low
 * surrogate must be immediately preceded by a high surrogate. Any deviation =>
 * lone/unpaired surrogate => NOT well-formed.
 */
function isWellFormedUtf16(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const u = s.charCodeAt(i);
    if (u >= 0xd800 && u <= 0xdbff) {
      // high surrogate: next must be a low surrogate
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : -1;
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      i++; // consume the low surrogate
    } else if (u >= 0xdc00 && u <= 0xdfff) {
      // lone low surrogate (a paired one is skipped above)
      return false;
    }
  }
  return true;
}

/** Secondary, independent well-formedness oracle via encodeURIComponent. */
function isWellFormedViaEncode(s: string): boolean {
  try {
    encodeURIComponent(s);
    return true;
  } catch {
    return false; // throws URIError on lone surrogate
  }
}

// Sanity-check the helpers themselves on known-bad input so we trust them.
describe('helper self-sanity (proving the bench has teeth)', () => {
  test('isWellFormedUtf16 rejects a lone high surrogate', () => {
    const lone = '\uD83D'; // high surrogate of 😀, no low partner
    expect(isWellFormedUtf16(lone)).toBe(false);
    expect(isWellFormedViaEncode(lone)).toBe(false);
  });
  test('isWellFormedUtf16 rejects a lone low surrogate', () => {
    const lone = '\uDE00'; // low surrogate of 😀
    expect(isWellFormedUtf16(lone)).toBe(false);
    expect(isWellFormedViaEncode(lone)).toBe(false);
  });
  test('isWellFormedUtf16 accepts a proper pair', () => {
    expect(isWellFormedUtf16('😀')).toBe(true);
    expect('😀'.length).toBe(2); // 2 UTF-16 units
    expect(codePointLength('😀')).toBe(1); // 1 code point
  });
});

// ---------------------------------------------------------------------------
// Phase: hand-derived golden examples (from spec "Worked examples").
// ---------------------------------------------------------------------------
describe('worked examples (hand-derived golden)', () => {
  test('truncate("hello", 3) === "hel"', () => {
    expect(truncate('hello', 3)).toBe('hel');
  });
  test('truncate("hello", 10) === "hello"', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
  test('truncate("😀😀😀", 2) === "😀😀" (2 cps, 4 utf16 units)', () => {
    const out = truncate('😀😀😀', 2);
    expect(out).toBe('😀😀');
    expect(out.length).toBe(4); // UTF-16 units
    expect(codePointLength(out)).toBe(2);
  });
  test('truncate("a😀b", 2) === "a😀"', () => {
    expect(truncate('a😀b', 2)).toBe('a😀');
  });
  test('truncate("", 5) === ""', () => {
    expect(truncate('', 5)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Phase: directed edge cases.
// ---------------------------------------------------------------------------
describe('directed edge cases', () => {
  test('truncate(s, 0) === "" for non-empty s', () => {
    expect(truncate('hello', 0)).toBe('');
    expect(truncate('😀', 0)).toBe('');
  });

  test('truncate("", 0) === ""', () => {
    expect(truncate('', 0)).toBe('');
  });

  test('exact boundary: n === codePointLength(s) returns s unchanged', () => {
    expect(truncate('hello', 5)).toBe('hello');
    expect(truncate('😀😀😀', 3)).toBe('😀😀😀');
  });

  test('split exactly at a surrogate-pair boundary keeps whole emoji', () => {
    // "a😀" is utf16 [a, hi, lo]. Truncating to 1 code point must give "a",
    // never "a"+high-surrogate.
    expect(truncate('a😀', 1)).toBe('a');
    // Truncating "😀b" to 1 code point => the whole emoji "😀".
    expect(truncate('😀b', 1)).toBe('😀');
  });

  test('combining sequence: each combining mark is its own code point (DECOMPOSED)', () => {
    // Built from explicit code units so there is NO ambiguity: "e" (U+0065) +
    // combining acute accent (U+0301). DECOMPOSED = two code points, both BMP
    // (no surrogate pair). NOT the precomposed NFC form U+00E9.
    const eAcute = String.fromCharCode(0x0065, 0x0301); // eslint-disable-line  --'é';
    expect(codePointLength(eAcute)).toBe(2);
    expect(eAcute.length).toBe(2); // two BMP code units; no surrogate involved
    // Truncate to 1 code point => just "e" (the base letter), dropping accent.
    // (Spec counts code points, not grapheme clusters.)
    expect(truncate(eAcute, 1)).toBe('e');
    expect(truncate(eAcute, 2)).toBe(eAcute);
  });

  test('n=1 on astral string yields the single leading code point', () => {
    expect(truncate('😀abc', 1)).toBe('😀');
  });
});

// ---------------------------------------------------------------------------
// Phase: error paths (maxCodePoints must be a non-negative integer).
// ---------------------------------------------------------------------------
describe('error paths', () => {
  test('negative integer throws', () => {
    expect(() => truncate('hello', -1)).toThrow();
    expect(() => truncate('hello', -5)).toThrow();
  });
  test('non-integer (fractional) throws', () => {
    expect(() => truncate('hello', 1.5)).toThrow();
    expect(() => truncate('hello', 0.1)).toThrow();
  });
  test('NaN throws', () => {
    expect(() => truncate('hello', NaN)).toThrow();
  });
  test('Infinity throws (not a non-negative INTEGER)', () => {
    expect(() => truncate('hello', Infinity)).toThrow();
    expect(() => truncate('hello', -Infinity)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Constrained-random generators — MUST include astral & combining chars.
// ---------------------------------------------------------------------------

// fast-check v4: `unit: 'binary'` emits any code point in 0000-10FFFF EXCEPT
// half surrogate pairs => a well-formed full-Unicode string incl. astral planes.
// maxLength counts code-point units, not UTF-16 units.
const arbStr = fc.string({ unit: 'binary', maxLength: 40 });

// A string biased toward astral + combining content so boundary bugs surface.
const astralCp = fc.constantFrom('😀', '🎉', '𝕏', '🚀', '𠀀'); // each a single astral code point
const combiningCp = fc.constantFrom('́', '̈', '̧'); // combining marks
const asciiCp = fc.constantFrom(...'abcDEF123 ');
const mixedCp = fc.oneof(astralCp, combiningCp, asciiCp, fc.string({ unit: 'binary', minLength: 1, maxLength: 1 }));
const arbMixed = fc.array(mixedCp, { maxLength: 30 }).map((parts) => parts.join(''));

const arbN = fc.nat({ max: 60 });

// ---------------------------------------------------------------------------
// Phase: oracle-free invariants (the heart of independence).
// ---------------------------------------------------------------------------
describe('invariants — oracle-free (fullUnicode)', () => {
  test('INV-Validity: output is ALWAYS well-formed UTF-16 (no lone surrogate)', () => {
    fc.assert(
      fc.property(arbStr, arbN, (s, n) => {
        const out = truncate(s, n);
        expect(isWellFormedUtf16(out)).toBe(true);
        expect(isWellFormedViaEncode(out)).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  test('INV-Bound: [...truncate(s,n)].length <= n', () => {
    fc.assert(
      fc.property(arbStr, arbN, (s, n) => {
        expect(codePointLength(truncate(s, n))).toBeLessThanOrEqual(n);
      }),
      { numRuns: 2000 }
    );
  });

  test('INV-Prefix: output === first min(n, len) code points of s', () => {
    fc.assert(
      fc.property(arbStr, arbN, (s, n) => {
        const cps = codePoints(s);
        const expectedPrefix = cps.slice(0, Math.min(n, cps.length)).join('');
        expect(truncate(s, n)).toBe(expectedPrefix);
      }),
      { numRuns: 2000 }
    );
  });

  test('INV-NoOp: if codePointLength(s) <= n then truncate(s,n) === s', () => {
    fc.assert(
      fc.property(arbStr, arbN, (s, n) => {
        if (codePointLength(s) <= n) {
          expect(truncate(s, n)).toBe(s);
        }
      }),
      { numRuns: 2000 }
    );
  });

  test('INV-Idempotent: truncate(truncate(s,n),n) === truncate(s,n)', () => {
    fc.assert(
      fc.property(arbStr, arbN, (s, n) => {
        const once = truncate(s, n);
        expect(truncate(once, n)).toBe(once);
      }),
      { numRuns: 2000 }
    );
  });
});

describe('invariants — astral/combining-biased stimulus', () => {
  test('INV-Validity (astral/combining biased)', () => {
    fc.assert(
      fc.property(arbMixed, arbN, (s, n) => {
        const out = truncate(s, n);
        expect(isWellFormedUtf16(out)).toBe(true);
      }),
      { numRuns: 3000 }
    );
  });

  test('INV-Bound + INV-Prefix (astral/combining biased)', () => {
    fc.assert(
      fc.property(arbMixed, arbN, (s, n) => {
        const out = truncate(s, n);
        expect(codePointLength(out)).toBeLessThanOrEqual(n);
        const cps = codePoints(s);
        const expectedPrefix = cps.slice(0, Math.min(n, cps.length)).join('');
        expect(out).toBe(expectedPrefix);
      }),
      { numRuns: 3000 }
    );
  });

  test('exhaustive boundary sweep over an astral-heavy string', () => {
    // Sweep n from 0..len+2 over a string mixing ASCII + astral so that EVERY
    // possible cut lands either between code points or at a surrogate boundary.
    const s = 'a😀b🎉c𝕏d';
    const len = codePointLength(s); // 7
    const cps = codePoints(s);
    for (let n = 0; n <= len + 3; n++) {
      const out = truncate(s, n);
      expect(isWellFormedUtf16(out)).toBe(true);
      expect(codePointLength(out)).toBeLessThanOrEqual(n);
      expect(out).toBe(cps.slice(0, Math.min(n, len)).join(''));
    }
  });
});

// ---------------------------------------------------------------------------
// Phase: adversarial / fuzz — strings that ALREADY contain lone surrogates,
// plus pathological inputs. truncate must still produce well-formed output
// where the spec's prefix is well-formed, and must not crash.
// ---------------------------------------------------------------------------
describe('adversarial / fuzz', () => {
  test('does not crash on assorted pathological strings', () => {
    const samples = [
      '😀'.repeat(50),
      '́'.repeat(20), // leading combining marks
      'a'.repeat(1000),
      '🧑‍🚀👨‍👩‍👧‍👦', // ZWJ family / profession sequences
      '🇺🇸🇬🇧', // regional indicator flags
      '\t\n\r ',
    ];
    for (const s of samples) {
      for (const n of [0, 1, 2, 3, 10, 100]) {
        expect(() => truncate(s, n)).not.toThrow();
        expect(isWellFormedUtf16(truncate(s, n))).toBe(true);
      }
    }
  });

  // Inputs that themselves contain lone surrogates are technically not
  // well-formed strings. The spec invariant ("never EMIT a lone surrogate")
  // is about the OUTPUT. We verify the output's code-point prefix matches and
  // that no NEW unpaired surrogate is introduced beyond what the prefix of the
  // (ill-formed) source would naturally contain. We assert: code-point bound
  // holds, and it does not throw.
  test('handles inputs containing lone surrogates without throwing', () => {
    const ill = ['a\uD83Db', 'a\uDE00b', '\uD83D', '\uDE00', 'x\uD83D\uD83Dy'];
    for (const s of ill) {
      for (const n of [0, 1, 2, 3, 5]) {
        expect(() => truncate(s, n)).not.toThrow();
        // [...s] iterates by code point; lone surrogates each count as 1 cp.
        expect(codePointLength(truncate(s, n))).toBeLessThanOrEqual(n);
      }
    }
  });
});
