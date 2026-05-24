import { createHmac } from 'node:crypto';

export interface Session {
  userId: string;
  token: string;
  expiresAt: number; // epoch milliseconds
  signature: string;
}

/** Canonical signature over (userId, token, expiresAt). Identical in both impls. */
export function signSession(
  userId: string,
  token: string,
  expiresAt: number,
  secret: string
): string {
  return createHmac('sha256', secret).update(`${userId}.${token}.${expiresAt}`).digest('base64');
}

/**
 * Return the authenticated userId, or throw if the session is not valid.
 * Valid iff: non-empty token AND signature matches AND not yet expired.
 */
export function verifySession(session: Session, now: number, secret: string): string {
  if (!session.token) throw new Error('unauthenticated: missing token');
  const expected = signSession(session.userId, session.token, session.expiresAt, secret);
  if (session.signature !== expected) throw new Error('unauthenticated: bad signature');
  if (now >= session.expiresAt) throw new Error('unauthenticated: expired');
  return session.userId;
}
