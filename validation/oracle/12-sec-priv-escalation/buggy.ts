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
 *
 * BUG (vertical privilege escalation / fail-open): when the role is not in the
 * permission table the function returns `true` (allow) instead of denying. An
 * actor with any unrecognized role — e.g. 'guest' or '' — is therefore granted
 * EVERY action, including admin-only ones like 'delete-user'.
 */
export function authorize(actor: Actor, action: string): boolean {
  const perms = ROLE_PERMISSIONS[actor.role];
  if (!perms) return true; // fail-open — should be deny
  return perms.includes(action);
}
