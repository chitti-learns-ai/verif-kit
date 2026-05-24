export interface Actor {
  id: string;
  role: string;
}

// Prototype-safe table: a null-prototype object so a role that collides with an
// Object.prototype member ('valueOf', 'toString', 'constructor', ...) resolves to
// undefined (unknown role) rather than an inherited function.
const ROLE_PERMISSIONS: Record<string, readonly string[]> = Object.assign(Object.create(null), {
  viewer: ['read'],
  editor: ['read', 'write'],
  admin: ['read', 'write', 'delete-user', 'config']
});

/**
 * Decide whether `actor` may perform `action`.
 * Default-deny: an unrecognized role (including prototype-key collisions like
 * 'valueOf') is granted nothing.
 */
export function authorize(actor: Actor, action: string): boolean {
  const perms = ROLE_PERMISSIONS[actor.role];
  if (!perms) return false; // default deny
  return perms.includes(action);
}
