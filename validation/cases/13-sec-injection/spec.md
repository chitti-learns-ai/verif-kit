# Spec — Parameterized user-lookup query builder

Builds the database query that finds a user by exact name. The query is meant to
be executed by a driver that supports bound parameters (placeholders).
**Resistance to SQL injection is the point of this spec.**

## Interface

```ts
export interface ParameterizedQuery {
  sql: string;       // the query text, with placeholders for values
  params: string[];  // the values to bind to the placeholders, in order
}

/** Build the query that selects id and name from the users table where name equals `username`. */
export function buildUserLookup(username: string): ParameterizedQuery;
```

## Contract (the security contract)

The query must select `id` and `name` from the `users` table, matching rows whose
`name` equals the supplied `username`. The `username` is **untrusted input** and
must be carried as a **bound parameter**, never spliced into the SQL text:

1. `sql` MUST use exactly **one** placeholder (`?`) where the username value goes.
2. The raw `username` value MUST be returned in `params` (as the single element),
   and MUST NOT appear interpolated inside `sql`.
3. Because the value is parameter-bound, `sql` is **independent of the username's
   content** — building a lookup for a benign name and for a hostile name yields
   the **same `sql`**, differing only in `params`. A username containing quotes,
   spaces, `OR`, `;`, `--`, etc. must not change the structure or meaning of the
   query.

## Worked examples

```ts
buildUserLookup('alice');
//  → { sql: 'SELECT id, name FROM users WHERE name = ?', params: ['alice'] }

buildUserLookup("x' OR '1'='1");
//  → { sql: 'SELECT id, name FROM users WHERE name = ?', params: ["x' OR '1'='1"] }
//    (identical sql; the hostile text is data in params, not code in sql)
```

## Invariants

- **Injection-proof**: for any two usernames, `buildUserLookup(a).sql === buildUserLookup(b).sql`.
- **Value preserved**: `buildUserLookup(u).params` deep-equals `[u]` (the exact input, unmodified).
- **One placeholder**: `sql` contains exactly one `?` and no quoted string literal holding the username.

## Out of scope

Actually executing the query, escaping rules of a specific SQL dialect, or column
selection beyond `id, name`. The behavior under test is whether the username is
**parameter-bound rather than interpolated**.
