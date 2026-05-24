# Spec — Public user profile serializer

Converts an internal `User` record into the **public** representation that is
safe to send in an API response or embed in a page. **Not leaking secrets is the
point of this spec.**

## Interface

```ts
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // secret
  apiToken: string;     // secret
  mfaSecret: string;    // secret
  role: string;         // internal, not public
}

export interface PublicProfile {
  id: string;
  name: string;
  email: string;
}

/** Return the public, API-safe view of `user`. */
export function toPublicProfile(user: User): PublicProfile;
```

## Contract (the security contract)

`toPublicProfile(user)` returns an object that contains **exactly** the public
fields and **nothing else**:

1. It MUST include `id`, `name`, and `email`, copied unchanged from `user`.
2. It MUST contain **no other keys**. In particular it MUST NOT include
   `passwordHash`, `apiToken`, `mfaSecret`, `role`, or any field that is not in
   the public allowlist `{ id, name, email }`.
3. This is an **allowlist** guarantee: only the three named fields may appear.
   Any field present on `user` that is not in the allowlist must be absent from
   the result — including fields that might be added to `User` in the future.

## Worked examples

```ts
const user = {
  id: 'u1', name: 'Sam', email: 'sam@example.com',
  passwordHash: 'pbkdf2$...', apiToken: 'tok_live_abc', mfaSecret: 'JBSWY3DP', role: 'admin'
};

toPublicProfile(user);
//  → { id: 'u1', name: 'Sam', email: 'sam@example.com' }
//    NO passwordHash, NO apiToken, NO mfaSecret, NO role.
```

## Invariants

- **No secret leakage**: for any `user`, the result has no `passwordHash`,
  `apiToken`, or `mfaSecret` key (and no `role`).
- **Allowlist only**: `Object.keys(result)` is a subset of `{ id, name, email }`.
- **Faithful public fields**: `result.id/name/email` equal `user`'s.

## Out of scope

Encryption, redaction of the public fields themselves, or audit logging. The
behavior under test is whether the serializer **excludes everything outside the
public allowlist**.
