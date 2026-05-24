// Independent (blind) verification environment for: Parameterized user-lookup builder.
// Derived from spec.md ALONE. The SUT is imported only from './sut'.
//
// Security contract under test (buildUserLookup):
//   - sql selects id, name from users where name = ?  (exactly ONE placeholder)
//   - the raw username is carried in params (single element), NOT interpolated into sql
//   - sql is INDEPENDENT of the username's content: build(a).sql === build(b).sql
//   - params deep-equals [username] exactly (value preserved, unmodified)
//
// The injection-proof invariant (sql identical for any two usernames) is an
// oracle-free metamorphic relation: it must hold for ANY correct implementation,
// regardless of the exact SQL string the implementation chooses.

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { buildUserLookup } from './sut';

const HOSTILE: string[] = [
  "x' OR '1'='1",
  "'; DROP TABLE users; --",
  'alice"; DELETE FROM users WHERE name="',
  "admin'--",
  "' UNION SELECT password FROM users --",
  '\\',
  '" OR ""="',
  "Robert'); DROP TABLE students;--",
  '`backtick`',
  '\n\r\t',
  '%',
  '?', // a literal question mark in the value must not be mistaken for a placeholder
  '',
  '   ',
  'José Ñoño', // unicode benign
  'a'.repeat(500)
];

const BENIGN = 'alice';

describe('13-sec-injection — worked example (spec verbatim)', () => {
  test("buildUserLookup('alice') matches the spec example", () => {
    const q = buildUserLookup('alice');
    expect(q.sql).toBe('SELECT id, name FROM users WHERE name = ?');
    expect(q.params).toEqual(['alice']);
  });

  test('hostile name yields IDENTICAL sql, value lives in params', () => {
    const q = buildUserLookup("x' OR '1'='1");
    expect(q.sql).toBe('SELECT id, name FROM users WHERE name = ?');
    expect(q.params).toEqual(["x' OR '1'='1"]);
  });
});

describe('13-sec-injection — structural invariants', () => {
  test('value preserved: params deep-equals [username], unmodified', () => {
    for (const u of HOSTILE) {
      const q = buildUserLookup(u);
      expect(q.params).toEqual([u]);
      expect(q.params.length).toBe(1);
      expect(q.params[0]).toBe(u); // exact identity of the string, no escaping/trimming
    }
  });

  test('exactly one placeholder (?) in sql', () => {
    const q = buildUserLookup(BENIGN);
    const placeholders = (q.sql.match(/\?/g) ?? []).length;
    expect(placeholders).toBe(1);
  });

  test('sql selects id, name from users and matches on name', () => {
    // structural sanity without over-constraining whitespace/dialect
    const sql = buildUserLookup(BENIGN).sql.toLowerCase();
    expect(sql).toContain('select');
    expect(sql).toContain('id');
    expect(sql).toContain('name');
    expect(sql).toContain('from users');
    expect(sql).toContain('where');
  });

  // NOTE: a substring check (`q.sql.includes(u) === false`) was REMOVED here as
  // unsound: a spec-correct parameterized query legitimately contains substrings
  // that can equal the username — e.g. username '?' equals the placeholder, and
  // benign words like 'name'/'id'/'users' appear in the fixed SQL skeleton — so
  // the check produces false positives on correct implementations. Non-interpolation
  // is fully and soundly proven below by: (a) sql is byte-identical for ANY two
  // usernames [build(a).sql === build(b).sql], (b) exactly one '?' placeholder,
  // and (c) params deep-equals [username] (the raw value is carried as data, not code).
});

describe('13-sec-injection — injection-proof metamorphic relation', () => {
  test('sql is independent of username content (benign vs hostile)', () => {
    const benignSql = buildUserLookup(BENIGN).sql;
    for (const u of HOSTILE) {
      expect(buildUserLookup(u).sql).toBe(benignSql);
    }
  });

  test('property: for any two usernames, sql is identical and params carries the raw value', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 64 }), fc.string({ maxLength: 64 }), (a, b) => {
        const qa = buildUserLookup(a);
        const qb = buildUserLookup(b);
        // structure/meaning invariant under any input
        expect(qa.sql).toBe(qb.sql);
        // exactly one placeholder, regardless of input
        expect((qa.sql.match(/\?/g) ?? []).length).toBe(1);
        // value-preservation
        expect(qa.params).toEqual([a]);
        expect(qb.params).toEqual([b]);
      }),
      { numRuns: 250 }
    );
  });

  // NOTE: a randomized property asserting `q.sql.includes(u) === false` was REMOVED
  // here for the same unsoundness reason as above — even "non-trivial" random values
  // can be substrings of the fixed SQL skeleton (or equal the '?' placeholder), which
  // makes it fail on a spec-correct implementation. The content-independence property
  // above (build(a).sql === build(b).sql, single placeholder, params carries raw value)
  // already proves non-interpolation soundly and still FAILS on any interpolating impl.
});
