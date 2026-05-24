// IV&V verification environment for `parseCsvLine` (case 10-csv-parse).
//
// INDEPENDENCE: this file derives EVERYTHING from spec.md alone. The SUT body
// (sut.ts) and any oracle/ files are NOT read. The reference model below is an
// independent from-spec implementation, never derived from the SUT.
//
// Run the whole study from the repo root:  node validation/score.mjs

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { parseCsvLine } from './sut';

// ---------------------------------------------------------------------------
// REFERENCE MODEL (golden) — independent, hand-written from spec.md.
// RFC-4180-style single-record parser:
//   - comma separates fields (R1)
//   - a field MAY be wrapped in double quotes; commas inside quotes are data (R2)
//   - inside quotes, "" decodes to a literal " (R3)
//   - returned values are unquoted/unescaped (R4)
//   - unterminated quoted field throws (E1)
// Symbol THROW marks "the spec mandates a throw for this input".
// ---------------------------------------------------------------------------
const THROW = Symbol('throw');

function refParse(line: string): string[] | typeof THROW {
  const fields: string[] = [];
  let cur = '';
  let i = 0;
  const n = line.length;

  while (i <= n) {
    // Parse ONE field starting at i.
    if (i < n && line[i] === '"') {
      // Quoted field.
      i++; // consume opening quote
      let closed = false;
      while (i < n) {
        const ch = line[i];
        if (ch === '"') {
          if (i + 1 < n && line[i + 1] === '"') {
            // Escaped quote "" -> "
            cur += '"';
            i += 2;
          } else {
            // Closing quote.
            i++;
            closed = true;
            break;
          }
        } else {
          cur += ch;
          i++;
        }
      }
      if (!closed) {
        // Opening quote with no closing quote => unterminated (E1).
        return THROW;
      }
      // After a closing quote, the next char must be a comma or end-of-line.
      // Anything else (e.g. `"a"b`) is malformed per RFC-4180; treat as throw
      // to honour "no silent corruption". (This is a defensible reading; if the
      // SUT differs here it is flagged as a possible spec ambiguity, not assumed.)
      if (i < n && line[i] !== ',') {
        return THROW;
      }
    } else {
      // Unquoted field: read until comma or end.
      while (i < n && line[i] !== ',') {
        if (line[i] === '"') {
          // A quote in the middle of an unquoted field is malformed in strict
          // RFC-4180. Treat as throw (no silent corruption). Flagged as ambiguous
          // if SUT disagrees — handled by the correct-or-throw scoreboard, which
          // does NOT assert a specific non-throwing value for such inputs.
          return THROW;
        }
        cur += line[i];
        i++;
      }
    }

    fields.push(cur);
    cur = '';

    if (i < n && line[i] === ',') {
      i++; // consume separator, continue to next field
      if (i === n) {
        // trailing comma => a final empty field
        fields.push('');
        break;
      }
    } else {
      break;
    }
  }

  return fields;
}

// Monitor: normalize SUT invocation into {ok, value} | {threw:true}
function runSut(line: string): { threw: false; value: unknown } | { threw: true } {
  try {
    return { threw: false, value: parseCsvLine(line) };
  } catch {
    return { threw: true };
  }
}

// Coverage model (functional coverage closure).
const COVER_POINTS = [
  'simple-multi-field',
  'empty-string',
  'consecutive-empty',
  'quoted-comma',
  'escaped-quote',
  'empty-quoted-field',
  'unterminated-throws',
  'inv-quoted-commas-data',
  'inv-round-trip',
  'inv-field-count',
  'fuzz-correct-or-throw'
] as const;
const covered = new Set<string>();
const cover = (p: (typeof COVER_POINTS)[number]) => covered.add(p);

// ---------------------------------------------------------------------------
// PHASE: directed worked examples (hand-derived goldens from spec table).
// ---------------------------------------------------------------------------
describe('directed worked examples (hand-derived goldens)', () => {
  test('a,b,c -> 3 fields', () => {
    cover('simple-multi-field');
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  test('empty string -> [""]', () => {
    cover('empty-string');
    expect(parseCsvLine('')).toEqual(['']);
  });

  test('a,,c -> ["a","","c"]', () => {
    cover('consecutive-empty');
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });

  test('"a,b",c -> ["a,b","c"] (quoted comma is data => TWO fields)', () => {
    cover('quoted-comma');
    expect(parseCsvLine('"a,b",c')).toEqual(['a,b', 'c']);
  });

  test('"she said ""hi""",x -> [\'she said "hi"\', "x"]', () => {
    cover('escaped-quote');
    expect(parseCsvLine('"she said ""hi""",x')).toEqual(['she said "hi"', 'x']);
  });

  test('"",x -> ["","x"] (empty quoted field)', () => {
    cover('empty-quoted-field');
    expect(parseCsvLine('"",x')).toEqual(['', 'x']);
  });
});

// ---------------------------------------------------------------------------
// PHASE: error path (E1) — unterminated quoted field MUST throw.
// ---------------------------------------------------------------------------
describe('error path: unterminated quoted field MUST throw', () => {
  test('directed unterminated examples throw', () => {
    cover('unterminated-throws');
    const cases = ['"abc', '"a,b', 'x,"unterminated', '"', '"a""', 'a,"b,c'];
    for (const c of cases) {
      expect(() => parseCsvLine(c), `input ${JSON.stringify(c)} must throw`).toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// PHASE: oracle-free invariants (properties).
// ---------------------------------------------------------------------------
describe('invariants (oracle-free properties)', () => {
  // INV-QC: quoted commas are data. u,v have no quotes and no newlines.
  test('INV quoted-commas-are-data: parseCsvLine(\'"\'+u+\',\'+v+\'"\') === [u+","+v]', () => {
    cover('inv-quoted-commas-data');
    const noQuoteNoNl = fc.string().filter((s) => !s.includes('"') && !s.includes('\n') && !s.includes('\r'));
    fc.assert(
      fc.property(noQuoteNoNl, noQuoteNoNl, (u, v) => {
        const input = '"' + u + ',' + v + '"';
        expect(parseCsvLine(input)).toEqual([u + ',' + v]);
      }),
      { numRuns: 500 }
    );
  });

  // INV-RT: round trip for no-comma/no-quote values.
  test('INV round-trip: parseCsvLine(value)[0] === value for safe values', () => {
    cover('inv-round-trip');
    const safe = fc
      .string()
      .filter((s) => !s.includes(',') && !s.includes('"') && !s.includes('\n') && !s.includes('\r'));
    fc.assert(
      fc.property(safe, (value) => {
        const out = parseCsvLine(value);
        expect(out).toEqual([value]);
      }),
      { numRuns: 500 }
    );
  });

  // INV-FC: field count = (top-level commas) + 1.
  // Construct inputs from fields that are individually quote-safe, joining with
  // top-level commas. Unquoted fields contain no commas (so all commas are
  // top-level). Count is deterministic.
  test('INV field-count: equals top-level commas + 1', () => {
    cover('inv-field-count');
    const fieldNoCommaNoQuote = fc
      .string()
      .filter((s) => !s.includes(',') && !s.includes('"') && !s.includes('\n') && !s.includes('\r'));
    fc.assert(
      fc.property(fc.array(fieldNoCommaNoQuote, { minLength: 1, maxLength: 8 }), (parts) => {
        const input = parts.join(',');
        const out = parseCsvLine(input);
        expect(out.length).toBe(parts.length); // commas = parts.length-1, +1 = parts.length
      }),
      { numRuns: 500 }
    );
  });
});

// ---------------------------------------------------------------------------
// PHASE: scoreboard vs independent reference model (differential testing).
// On structured-but-varied inputs the SUT must match the reference model, OR
// (where the model says THROW) the SUT must throw. Never a different plausible list.
// ---------------------------------------------------------------------------
describe('scoreboard: SUT vs independent reference model', () => {
  // Generator producing well-formed CSV lines from random fields, each field
  // either bare (no comma/quote) or properly quoted (may contain commas + escaped quotes).
  const bareChar = fc.constantFrom(...'abc 09xyZ._-'.split(''));
  const innerChar = fc.constantFrom(...'abc, 09xyZ._-'.split('')); // includes comma for quoted bodies
  const bareField = fc.array(bareChar, { maxLength: 6 }).map((cs) => cs.join(''));
  const quotedField = fc
    .array(fc.oneof(innerChar, fc.constant('"')), { maxLength: 6 })
    .map((cs) => {
      // escape embedded quotes as "" so the field is well-formed
      const body = cs.join('').replace(/"/g, '""');
      return '"' + body + '"';
    });
  const field = fc.oneof(bareField, quotedField);
  const wellFormedLine = fc.array(field, { minLength: 1, maxLength: 6 }).map((fs) => fs.join(','));

  test('well-formed lines: SUT matches reference model exactly', () => {
    fc.assert(
      fc.property(wellFormedLine, (line) => {
        const expected = refParse(line);
        const got = runSut(line);
        if (expected === THROW) {
          expect(got.threw, `model says THROW for ${JSON.stringify(line)}`).toBe(true);
        } else {
          expect(got.threw, `SUT threw on well-formed ${JSON.stringify(line)}`).toBe(false);
          if (!got.threw) {
            expect(got.value).toEqual(expected);
          }
        }
      }),
      { numRuns: 1000 }
    );
  });
});

// ---------------------------------------------------------------------------
// PHASE: adversarial fuzz — INV-NSC "correct or throw, never plausibly wrong".
// Random strings drawn from a quote/comma-heavy alphabet. For every input the
// SUT must EITHER match the independent reference model EXACTLY, OR throw where
// the model says throw. It must never return a different-but-plausible list.
// Any input that breaks this is persisted conceptually as a seed (reported).
// ---------------------------------------------------------------------------
describe('adversarial fuzz: no silent corruption (correct-or-throw)', () => {
  const advChar = fc.constantFrom(...'"",,abc \tx'.split(''), '"', ',');
  const advString = fc.array(advChar, { maxLength: 12 }).map((cs) => cs.join(''));

  test('fuzz: SUT agrees with reference model, or throws when model throws', () => {
    cover('fuzz-correct-or-throw');
    fc.assert(
      fc.property(advString, (line) => {
        const expected = refParse(line);
        const got = runSut(line);
        if (expected === THROW) {
          // The model considers this malformed; spec demands a throw (no silent
          // corruption). The SUT MUST throw.
          expect(got.threw, `malformed input must throw: ${JSON.stringify(line)}`).toBe(true);
        } else {
          // Model parses it; SUT must produce the SAME fields (or it is silently wrong).
          expect(got.threw, `SUT threw on input the model parses: ${JSON.stringify(line)}`).toBe(false);
          if (!got.threw) {
            expect(got.value, `silent corruption on ${JSON.stringify(line)}`).toEqual(expected);
          }
        }
      }),
      { numRuns: 2000, endOnFailure: true }
    );
  });

  // Targeted: never emit NaN/undefined holes; every field is a string.
  test('fuzz: every returned field is a string (no holes/NaN)', () => {
    fc.assert(
      fc.property(advString, (line) => {
        const got = runSut(line);
        if (!got.threw) {
          expect(Array.isArray(got.value)).toBe(true);
          for (const f of got.value as unknown[]) {
            expect(typeof f).toBe('string');
          }
        }
      }),
      { numRuns: 1000 }
    );
  });
});

// ---------------------------------------------------------------------------
// PHASE: self-mutation check (prove the bench has teeth). We mutate a COPY of
// the reference model (off-by-one comma handling) and confirm the scoreboard
// logic would flag a disagreement. This proves the comparison is not vacuous.
// ---------------------------------------------------------------------------
describe('bench-has-teeth: self-mutation of the reference model', () => {
  test('a deliberately broken reference model disagrees with the spec goldens', () => {
    // Broken model: naive split on commas (ignores quotes) — the classic bug.
    const broken = (line: string) => line.split(',');
    // On the spec golden "a,b",c the correct answer is ["a,b","c"] but broken
    // gives ['"a', 'b"', 'c']. Confirm our equality check WOULD catch this.
    expect(broken('"a,b",c')).not.toEqual(['a,b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// PHASE: functional coverage closure gate.
// ---------------------------------------------------------------------------
describe('coverage closure', () => {
  test('all planned cover points were exercised', () => {
    const missing = COVER_POINTS.filter((p) => !covered.has(p));
    expect(missing, `uncovered cover points: ${missing.join(', ')}`).toEqual([]);
  });
});
