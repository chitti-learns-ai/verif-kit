// Independent (blind) verification environment for: Signed session authentication.
// Derived from spec.md ALONE. The SUT is imported only from './sut'.
//
// Security contract under test (verifySession):
//   verifySession(session, now, secret) returns session.userId IFF ALL hold,
//   else MUST throw an Error:
//     (1) session.token is a non-empty string
//     (2) session.signature === signSession(userId, token, expiresAt, secret)
//     (3) NOT expired: now < session.expiresAt   (now >= expiresAt => reject)
//   Invariants: no expired access, no forged access, owner access.
//
// signSession contract: Base64 of HMAC-SHA256(secret, "userId.token.expiresAt"),
// deterministic, and sensitive to userId/token/expiresAt.
//
// Oracle discipline: we do NOT enshrine the DUT's output as expected. We build an
// INDEPENDENT signature oracle from Node crypto (the spec gives the exact formula)
// to produce known-valid and known-forged sessions, then judge verifySession.

import { describe, test, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import fc from 'fast-check';
import { signSession, verifySession, type Session } from './sut';

// --- Independent reference signature (from the spec formula, not from the DUT) ---
function refSign(userId: string, token: string, expiresAt: number, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${userId}.${token}.${expiresAt}`)
    .digest('base64');
}

const SECRET = 's3cr3t';

function freshValidSession(
  userId = 'alice',
  token = 'tok-A',
  expiresAt = 1_000_000,
  secret = SECRET
): Session {
  return { userId, token, expiresAt, signature: refSign(userId, token, expiresAt, secret) };
}

describe('11-sec-auth-bypass — signSession (signature contract)', () => {
  test('matches independent HMAC-SHA256 Base64 reference', () => {
    // The spec pins the exact construction; the DUT must produce it.
    expect(signSession('alice', 'tok-A', 1_000_000, SECRET)).toBe(
      refSign('alice', 'tok-A', 1_000_000, SECRET)
    );
  });

  test('is deterministic for identical inputs', () => {
    const a = signSession('bob', 't', 42, SECRET);
    const b = signSession('bob', 't', 42, SECRET);
    expect(a).toBe(b);
  });

  test('is sensitive to each of userId, token, expiresAt (and secret)', () => {
    const base = signSession('bob', 't', 42, SECRET);
    expect(signSession('bobX', 't', 42, SECRET)).not.toBe(base); // userId
    expect(signSession('bob', 'tX', 42, SECRET)).not.toBe(base); // token
    expect(signSession('bob', 't', 43, SECRET)).not.toBe(base); // expiresAt
    expect(signSession('bob', 't', 42, 'other')).not.toBe(base); // secret
  });
});

describe('11-sec-auth-bypass — verifySession (validity decision)', () => {
  test('owner access: valid, unexpired, signed session returns userId', () => {
    const s = freshValidSession('alice', 'tok-A', 1_000_000);
    expect(verifySession(s, 999_999, SECRET)).toBe('alice');
  });

  // --- Invariant: NO expired access (the replay-forever risk) ---
  test('now == expiresAt is EXPIRED and must throw (boundary)', () => {
    const exp = 1_000_000;
    const s = freshValidSession('alice', 'tok-A', exp);
    expect(() => verifySession(s, exp, SECRET)).toThrow();
  });

  test('now > expiresAt is expired and must throw', () => {
    const exp = 1_000_000;
    const s = freshValidSession('alice', 'tok-A', exp);
    expect(() => verifySession(s, exp + 1, SECRET)).toThrow();
  });

  test('expired token must be rejected EVEN with a perfect signature', () => {
    // captured-token replay: signature is genuinely valid, but clock is past expiry.
    const exp = 1_000_000;
    const s = freshValidSession('mallory', 'stolen', exp);
    expect(s.signature).toBe(refSign('mallory', 'stolen', exp, SECRET)); // sanity: truly valid sig
    expect(() => verifySession(s, exp + 5_000_000, SECRET)).toThrow();
  });

  // --- Invariant: NO forged access ---
  test('tampered signature must throw', () => {
    const s = { ...freshValidSession('alice', 'tok-A', 1_000_000), signature: 'x' };
    expect(() => verifySession(s, 999_999, SECRET)).toThrow();
  });

  test('signature valid under a DIFFERENT secret must throw (wrong key)', () => {
    const exp = 1_000_000;
    const s: Session = {
      userId: 'alice',
      token: 'tok-A',
      expiresAt: exp,
      signature: refSign('alice', 'tok-A', exp, 'attacker-secret')
    };
    expect(() => verifySession(s, exp - 1, SECRET)).toThrow();
  });

  test('attacker changes userId without re-signing -> must throw', () => {
    // Take a valid session for "alice", flip the claimed identity to "admin".
    const base = freshValidSession('alice', 'tok-A', 1_000_000);
    const forged: Session = { ...base, userId: 'admin' }; // signature still binds to "alice"
    expect(() => verifySession(forged, 999_999, SECRET)).toThrow();
  });

  test('attacker extends expiry without re-signing -> must throw', () => {
    const base = freshValidSession('alice', 'tok-A', 1_000_000);
    const forged: Session = { ...base, expiresAt: 9_999_999 }; // sig binds to old expiry
    expect(() => verifySession(forged, 1_000_001, SECRET)).toThrow();
  });

  test('empty signature must throw', () => {
    const s = { ...freshValidSession(), signature: '' };
    expect(() => verifySession(s, 999_999, SECRET)).toThrow();
  });

  // --- Invariant: non-empty token required ---
  test('empty token must throw even if (vacuously) signed over empty token', () => {
    const exp = 1_000_000;
    const s: Session = {
      userId: 'alice',
      token: '',
      expiresAt: exp,
      signature: refSign('alice', '', exp, SECRET) // signature itself is "correct"
    };
    expect(() => verifySession(s, exp - 1, SECRET)).toThrow();
  });

  // --- Properties ---
  test('property: a correctly-signed, unexpired, non-empty-token session always authenticates as its userId', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }), // userId
        fc.string({ minLength: 1, maxLength: 20 }), // token (non-empty)
        fc.integer({ min: 1, max: 2_000_000_000 }), // expiresAt
        fc.string({ minLength: 1, maxLength: 12 }), // secret
        (userId, token, expiresAt, secret) => {
          const s: Session = { userId, token, expiresAt, signature: refSign(userId, token, expiresAt, secret) };
          // now strictly before expiry
          expect(verifySession(s, expiresAt - 1, secret)).toBe(userId);
        }
      ),
      { numRuns: 150 }
    );
  });

  test('property: any session at-or-after expiry is rejected, even when validly signed', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 2_000_000_000 }),
        fc.nat({ max: 1_000_000 }), // overshoot >= 0
        (userId, token, expiresAt, overshoot) => {
          const s: Session = { userId, token, expiresAt, signature: refSign(userId, token, expiresAt, SECRET) };
          const now = expiresAt + overshoot; // now >= expiresAt
          expect(() => verifySession(s, now, SECRET)).toThrow();
        }
      ),
      { numRuns: 150 }
    );
  });

  test('property: any signature mismatch is rejected (forgery)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 2_000_000_000 }),
        fc.string({ maxLength: 24 }), // arbitrary forged signature
        (userId, token, expiresAt, forged) => {
          const good = refSign(userId, token, expiresAt, SECRET);
          fc.pre(forged !== good); // only consider genuinely-wrong signatures
          const s: Session = { userId, token, expiresAt, signature: forged };
          expect(() => verifySession(s, expiresAt - 1, SECRET)).toThrow();
        }
      ),
      { numRuns: 150 }
    );
  });
});
