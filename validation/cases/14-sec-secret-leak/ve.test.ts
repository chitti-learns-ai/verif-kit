// Independent (blind) verification environment for: Public user profile serializer.
// Derived from spec.md ALONE. The SUT is imported only from './sut'.
//
// Security contract under test (toPublicProfile):
//   - result includes id, name, email copied unchanged from user
//   - result contains NO other keys: it is an ALLOWLIST. Specifically no
//     passwordHash, apiToken, mfaSecret, role, or ANY field outside {id,name,email}
//   - allowlist must hold even for fields added to User in the future
//
// We check the leak invariant by enumerating result keys (what JSON.stringify and
// object spread expose), and by serializing to JSON to ensure secrets never reach
// the wire even if present non-enumerably-by-accident.

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { toPublicProfile, type User } from './sut';

const ALLOWLIST = ['id', 'name', 'email'] as const;
const SECRET_KEYS = ['passwordHash', 'apiToken', 'mfaSecret', 'role'] as const;

function makeUser(over: Partial<User> = {}): User {
  return {
    id: 'u1',
    name: 'Sam',
    email: 'sam@example.com',
    passwordHash: 'pbkdf2$deadbeef',
    apiToken: 'tok_live_abc123',
    mfaSecret: 'JBSWY3DPEHPK3PXP',
    role: 'admin',
    ...over
  };
}

describe('14-sec-secret-leak — worked example (spec verbatim)', () => {
  test('returns exactly {id, name, email}', () => {
    const r = toPublicProfile(makeUser());
    expect(r).toEqual({ id: 'u1', name: 'Sam', email: 'sam@example.com' });
    expect(Object.keys(r).sort()).toEqual([...ALLOWLIST].sort());
  });
});

describe('14-sec-secret-leak — faithful public fields', () => {
  test('id/name/email copied unchanged', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (id, name, email) => {
        const r = toPublicProfile(makeUser({ id, name, email }));
        expect(r.id).toBe(id);
        expect(r.name).toBe(name);
        expect(r.email).toBe(email);
      }),
      { numRuns: 100 }
    );
  });
});

describe('14-sec-secret-leak — no secret leakage (allowlist guarantee)', () => {
  test('result has none of the known secret/internal keys', () => {
    const r = toPublicProfile(makeUser());
    const keys = Object.keys(r);
    for (const secret of SECRET_KEYS) {
      expect(keys).not.toContain(secret);
      expect((r as Record<string, unknown>)[secret]).toBeUndefined();
    }
  });

  test('Object.keys(result) is a SUBSET of {id, name, email}', () => {
    const r = toPublicProfile(makeUser());
    for (const k of Object.keys(r)) {
      expect(ALLOWLIST).toContain(k as (typeof ALLOWLIST)[number]);
    }
  });

  test('JSON serialization (the wire form) leaks no secret values', () => {
    const u = makeUser({
      passwordHash: 'PWHASH_SENTINEL',
      apiToken: 'APITOKEN_SENTINEL',
      mfaSecret: 'MFASECRET_SENTINEL',
      role: 'ROLE_SENTINEL'
    });
    const wire = JSON.stringify(toPublicProfile(u));
    expect(wire).not.toContain('PWHASH_SENTINEL');
    expect(wire).not.toContain('APITOKEN_SENTINEL');
    expect(wire).not.toContain('MFASECRET_SENTINEL');
    expect(wire).not.toContain('ROLE_SENTINEL');
    expect(wire).not.toContain('passwordHash');
    expect(wire).not.toContain('apiToken');
    expect(wire).not.toContain('mfaSecret');
    expect(wire).not.toContain('"role"');
  });

  test('allowlist holds even when User carries UNKNOWN future fields', () => {
    // Spec invariant: any field not in the allowlist must be absent, including
    // fields that might be added to User in the future.
    const u = {
      ...makeUser(),
      ssn: '123-45-6789',
      internalNotes: 'do not expose',
      sessionToken: 'sess_xyz'
    } as unknown as User;
    const r = toPublicProfile(u);
    const keys = Object.keys(r);
    expect(keys.sort()).toEqual([...ALLOWLIST].sort());
    const wire = JSON.stringify(r);
    expect(wire).not.toContain('123-45-6789');
    expect(wire).not.toContain('do not expose');
    expect(wire).not.toContain('sess_xyz');
  });

  test('property: for any user (with random secret payloads), result keys are exactly the allowlist and no secret value appears on the wire', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          name: fc.string(),
          email: fc.string(),
          passwordHash: fc.string({ minLength: 1 }),
          apiToken: fc.string({ minLength: 1 }),
          mfaSecret: fc.string({ minLength: 1 }),
          role: fc.constantFrom('admin', 'editor', 'viewer', 'root')
        }),
        (u) => {
          const r = toPublicProfile(u as User);
          // EXACT allowlist — this is the sound, complete leak detector: any leaked
          // secret would add a key (or alter the key set), so requiring the result
          // keys to be exactly {id,name,email} fails on any leaking implementation
          // while passing on every correct one.
          expect(Object.keys(r).sort()).toEqual([...ALLOWLIST].sort());
          // public fields faithful
          expect(r.id).toBe(u.id);
          expect(r.name).toBe(u.name);
          expect(r.email).toBe(u.email);
          // NOTE: a `wire.includes(secretVal) === false` substring check was REMOVED
          // from this RANDOMIZED property as unsound: a short random secret (e.g. " "
          // or "d") can be a substring of the JSON structure or of a public field's
          // value, producing false positives on a spec-correct serializer. The
          // exact-allowlist assertion above already soundly proves no secret leaks.
          // (The separate standalone test using long unique SENTINEL values remains
          // and is sound — it cannot collide with structure or public values.)
        }
      ),
      { numRuns: 200 }
    );
  });
});
