# Spec — Role-based authorization

A role-based access-control (RBAC) decision function. Each actor has a single
role; each role grants a fixed set of actions. **Authorization correctness is the
point of this spec.**

## Interface

```ts
export interface Actor {
  id: string;
  role: string;
}

/** Return true iff `actor` is permitted to perform `action`. */
export function authorize(actor: Actor, action: string): boolean;
```

## Roles and their permitted actions (the policy)

| role     | permitted actions                          |
| -------- | ------------------------------------------ |
| `viewer` | `read`                                     |
| `editor` | `read`, `write`                            |
| `admin`  | `read`, `write`, `delete-user`, `config`   |

These are the **only** recognized roles.

## Authorization contract (the security contract)

- `authorize(actor, action)` returns `true` **iff** `action` is in the set of
  actions permitted for `actor.role` per the table above.
- **Default deny.** If `actor.role` is not one of the recognized roles
  (`viewer`, `editor`, `admin`) — including an empty, misspelled, or otherwise
  unknown role — the function returns `false` for **every** action. An
  unrecognized role grants **no** access. Privileged actions (`delete-user`,
  `config`) are reachable **only** by `admin`.

## Worked examples

```ts
authorize({ id: 'u1', role: 'viewer' }, 'read');         // true
authorize({ id: 'u1', role: 'viewer' }, 'write');        // false
authorize({ id: 'u2', role: 'editor' }, 'write');        // true
authorize({ id: 'u2', role: 'editor' }, 'delete-user');  // false
authorize({ id: 'u3', role: 'admin'  }, 'delete-user');  // true

authorize({ id: 'x',  role: 'guest'  }, 'read');         // false (unknown role → deny)
authorize({ id: 'x',  role: 'guest'  }, 'delete-user');  // false (unknown role → deny)
authorize({ id: 'x',  role: ''       }, 'config');       // false (unknown role → deny)
```

## Invariants

- **No privilege escalation**: an actor whose role is not `admin` can never be
  authorized for `delete-user` or `config`.
- **Default deny**: an unrecognized role is authorized for nothing.
- **Exact policy**: for a recognized role, `authorize` returns true exactly for
  the actions listed in the table and false for all others.

## Out of scope

How roles are assigned or authenticated; multiple roles per actor (each actor has
exactly one role string). The behavior under test is the **permission decision**.
