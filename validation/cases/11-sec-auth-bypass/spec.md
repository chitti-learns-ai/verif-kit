# Spec — Signed session authentication

A stateless session-authentication helper. A session is a signed token; the
server re-derives the signature to decide whether to trust it. **Authentication
correctness is the point of this spec.**

## Interface

```ts
export interface Session {
  userId: string;
  token: string;
  expiresAt: number; // epoch milliseconds — the instant the session stops being valid
  signature: string;
}

/** Canonical signature over (userId, token, expiresAt) using the server secret. */
export function signSession(userId: string, token: string, expiresAt: number, secret: string): string;

/** Return the authenticated userId, or throw an Error if the session is not valid. */
export function verifySession(session: Session, now: number, secret: string): string;
```

## Signature

`signSession` returns the Base64 of `HMAC-SHA256(secret, "${userId}.${token}.${expiresAt}")`.
It is deterministic: the same inputs always yield the same signature, and any
change to `userId`, `token`, or `expiresAt` yields a different signature.

## Validity contract (the security contract)

`verifySession(session, now, secret)` returns `session.userId` **only when ALL**
of the following hold; otherwise it MUST throw an `Error`:

1. `session.token` is a non-empty string.
2. `session.signature` equals `signSession(session.userId, session.token, session.expiresAt, secret)`
   — i.e. the signature verifies against the same secret.
3. The session has **not expired**: `now < session.expiresAt`.

A session that satisfies 1 and 2 but for which `now >= session.expiresAt` is
**expired and MUST be rejected** (throw). A valid signature does not by itself
grant access — an expired token, even a perfectly-signed one, must not
authenticate (otherwise a captured token would be replayable forever).

## Worked examples

```ts
const secret = 's3cr3t';
const exp = 1_000_000;
const sig = signSession('alice', 'tok-A', exp, secret);
const session = { userId: 'alice', token: 'tok-A', expiresAt: exp, signature: sig };

verifySession(session, exp - 1, secret);   // 'alice'   (signed and not yet expired)
verifySession(session, exp,     secret);   // THROWS    (now == expiresAt → expired)
verifySession(session, exp + 1, secret);   // THROWS    (expired)
verifySession({ ...session, signature: 'x' }, exp - 1, secret); // THROWS (bad signature)
verifySession({ ...session, token: '' },      exp - 1, secret); // THROWS (missing token)
```

## Invariants

- **No expired access**: if `now >= session.expiresAt`, `verifySession` throws, regardless of signature.
- **No forged access**: a session whose signature does not match throws.
- **Owner access**: a non-empty-token, correctly-signed, unexpired session returns its `userId`.

## Out of scope

The transport, how `secret` is stored, and how `token` is generated. The behavior
under test is the **validity decision** in `verifySession`.
