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
 * Allowlist: copy exactly the three public fields, nothing else.
 */
export function toPublicProfile(user: User): PublicProfile {
  return { id: user.id, name: user.name, email: user.email };
}
