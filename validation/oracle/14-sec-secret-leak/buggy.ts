export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  apiToken: string;
  mfaSecret: string;
  role: string;
}

export interface PublicProfile {
  id: string;
  name: string;
  email: string;
}

/**
 * Build the public, API-safe view of a user.
 *
 * BUG (sensitive data exposure): this uses a DENYLIST — it removes only
 * `passwordHash` and returns everything else. `apiToken`, `mfaSecret`, and
 * `role` leak into the response. A denylist that forgets a field (or any field
 * added later) silently exposes it.
 */
export function toPublicProfile(user: User): PublicProfile {
  const { passwordHash, ...rest } = user;
  return rest as PublicProfile;
}
